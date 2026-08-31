import { buildPaymentPlan } from './payment-plan'
import {
  buildSessionLog,
  normalizeSummaryText,
  participantOrder,
  type SummaryParticipant,
  type TimeFormatter,
} from './session-log'
import { buyinSum, netChips, toCny } from './settlement'
import { formatAmount } from './format'

export interface SessionSummaryData {
  group_name: string
  date: string
  description: string | null
  exchange_rate: number
  started_at: string | null
  ended_at: string | null
  participants: SummaryParticipant[]
}

export interface SessionSummaryOptions {
  detail_url: string
  format_time?: TimeFormatter
}

function browserTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatSignedChips(value: number): string {
  if (value > 0) return `+${formatAmount(value)} chips`
  if (value < 0) return `-${formatAmount(Math.abs(value))} chips`
  return '0 chips'
}

function formatSignedCny(value: number): string {
  if (value > 0) return `+¥${formatAmount(value)}`
  if (value < 0) return `-¥${formatAmount(Math.abs(value))}`
  return '¥0'
}

function formatCents(value: number): string {
  return `¥${formatAmount(value / 100)}`
}

export function buildSessionSummary(
  input: SessionSummaryData,
  options: SessionSummaryOptions,
): string {
  const imported = input.started_at === null
  const orderByPlayer = participantOrder(input.participants)
  const rows = input.participants.map(participant => {
    const totalBuyin = buyinSum(participant.buy_ins)
    const net = netChips(participant.final_chips, totalBuyin)
    return { participant, totalBuyin, net, order: orderByPlayer.get(participant.player_id) ?? Number.MAX_SAFE_INTEGER }
  })
  const totalBuyin = rows.reduce((sum, row) => sum + row.totalBuyin, 0)
  const totalNet = rows.reduce((sum, row) => sum + row.net, 0)
  const header = [
    normalizeSummaryText(input.group_name),
    [input.date, input.description ? normalizeSummaryText(input.description) : ''].filter(Boolean).join(' · '),
    `${formatAmount(input.exchange_rate)} chips = ¥1`,
    imported
      ? `${rows.length} ${rows.length === 1 ? 'player' : 'players'}`
      : `${rows.length} ${rows.length === 1 ? 'player' : 'players'} · total buy-in ${formatAmount(totalBuyin)} chips`,
  ]
  const sections: string[] = [header.join('\n')]

  if (input.started_at === null) {
    sections.push('Imported session · no live event log.')
  } else {
    sections.push(`EVENTS\n${buildSessionLog({
      started_at: input.started_at,
      ended_at: input.ended_at,
      participants: input.participants,
    }, options.format_time ?? browserTime).join('\n')}`)
  }

  const sortedRows = [...rows].sort((a, b) => b.net - a.net
    || a.order - b.order
    || a.participant.player_id.localeCompare(b.participant.player_id))
  const resultLines = sortedRows.map(row => {
    const name = normalizeSummaryText(row.participant.name)
    const result = `${formatSignedChips(row.net)} · ${formatSignedCny(toCny(row.net, input.exchange_rate))}`
    if (imported) return `${name} · ${result}`
    return `${name} · buy-in ${formatAmount(row.totalBuyin)} (${row.participant.buy_ins.length}x) · final ${formatAmount(row.participant.final_chips ?? 0)} · ${result}`
  })
  sections.push(`RESULTS\n${resultLines.join('\n')}`)

  const warnings: string[] = []
  if (!imported) {
    for (const row of rows.filter(row => row.participant.buy_ins.length === 0)) {
      warnings.push(`${normalizeSummaryText(row.participant.name)} has no buy-in record.`)
    }
  }
  if (totalNet !== 0) warnings.push(`Session is unbalanced by ${formatSignedChips(totalNet)}.`)
  if (warnings.length > 0) sections.push(`WARNING\n${warnings.join('\n')}`)

  if (totalNet === 0) {
    const plan = buildPaymentPlan(rows.map(row => ({
      playerId: row.participant.player_id,
      netChips: row.net,
    })), input.exchange_rate)
    const names = new Map(rows.map(row => [row.participant.player_id, normalizeSummaryText(row.participant.name)]))
    const payments = plan.transfers.length === 0
      ? ['No transfers required.']
      : plan.transfers.map(transfer =>
        `${names.get(transfer.fromPlayerId)} → ${names.get(transfer.toPlayerId)} · ${formatCents(transfer.amountCents)}`)
    if (plan.roundingAdjustmentCents > 0) {
      payments.push(`Includes a ${formatCents(plan.roundingAdjustmentCents)} rounding adjustment.`)
    }
    sections.push(`PAYMENTS\n${payments.join('\n')}`)
  }

  sections.push(`Session details: ${options.detail_url}`)

  return sections.join('\n\n')
}
