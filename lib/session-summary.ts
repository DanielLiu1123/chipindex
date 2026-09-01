import { buildPaymentPlan } from './payment-plan'
import {
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

interface SummaryRow {
  participant: SummaryParticipant
  totalBuyin: number
  net: number
  order: number
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
  if (value < 0) return `−¥${formatAmount(Math.abs(value))}`
  return '¥0'
}

function formatCents(value: number): string {
  return `¥${formatAmount(value / 100)}`
}

function formatOverview(
  input: SessionSummaryData,
  totalBuyin: number,
  formatTime: TimeFormatter,
): string {
  const playerCount = input.participants.length
  const parts: string[] = []
  if (input.started_at) {
    const start = formatTime(input.started_at)
    parts.push(input.ended_at ? `${start}–${formatTime(input.ended_at)}` : start)
  }
  parts.push(`${playerCount} ${playerCount === 1 ? 'player' : 'players'}`)
  parts.push(`${formatAmount(input.exchange_rate)} chips/¥1`)
  if (input.started_at) parts.push(`total buy-in ${formatAmount(totalBuyin)}`)
  return parts.join(' · ')
}

function formatPayments(rows: SummaryRow[], exchangeRate: number): string[] {
  const plan = buildPaymentPlan(rows.map(row => ({
    playerId: row.participant.player_id,
    netChips: row.net,
  })), exchangeRate)
  if (plan.transfers.length === 0) return ['• No payments required.']

  const rowsById = new Map(rows.map(row => [row.participant.player_id, row]))
  const transfersByPayer = new Map<string, typeof plan.transfers>()
  for (const transfer of plan.transfers) {
    const payerTransfers = transfersByPayer.get(transfer.fromPlayerId) ?? []
    payerTransfers.push(transfer)
    transfersByPayer.set(transfer.fromPlayerId, payerTransfers)
  }

  const paymentLines = [...transfersByPayer]
    .sort(([leftId], [rightId]) => {
      const left = rowsById.get(leftId)!
      const right = rowsById.get(rightId)!
      return left.net - right.net
        || left.order - right.order
        || leftId.localeCompare(rightId)
    })
    .map(([payerId, transfers]) => {
      const payer = normalizeSummaryText(rowsById.get(payerId)!.participant.name)
      const recipients = [...transfers]
        .sort((left, right) => right.amountCents - left.amountCents
          || (rowsById.get(left.toPlayerId)?.order ?? Number.MAX_SAFE_INTEGER)
          - (rowsById.get(right.toPlayerId)?.order ?? Number.MAX_SAFE_INTEGER)
          || left.toPlayerId.localeCompare(right.toPlayerId))
        .map(transfer => {
          const recipient = normalizeSummaryText(rowsById.get(transfer.toPlayerId)!.participant.name)
          return `${recipient} ${formatCents(transfer.amountCents)}`
        })
      return `• ${payer} → ${recipients.join(' + ')}`
    })

  if (plan.roundingAdjustmentCents > 0) {
    paymentLines.push(`• Rounding adjustment: ${formatCents(plan.roundingAdjustmentCents)}`)
  }
  return paymentLines
}

export function buildSessionSummary(
  input: SessionSummaryData,
  options: SessionSummaryOptions,
): string {
  const imported = input.started_at === null
  const orderByPlayer = participantOrder(input.participants)
  const rows: SummaryRow[] = input.participants.map(participant => {
    const totalBuyin = buyinSum(participant.buy_ins)
    const net = netChips(participant.final_chips, totalBuyin)
    return { participant, totalBuyin, net, order: orderByPlayer.get(participant.player_id) ?? Number.MAX_SAFE_INTEGER }
  })
  const totalBuyin = rows.reduce((sum, row) => sum + row.totalBuyin, 0)
  const totalNet = rows.reduce((sum, row) => sum + row.net, 0)
  const formatTime = options.format_time ?? browserTime
  const sections = [
    `${normalizeSummaryText(input.group_name)} | ${normalizeSummaryText(input.date)}\n${formatOverview(input, totalBuyin, formatTime)}`,
  ]

  const sortedRows = [...rows].sort((left, right) => right.net - left.net
    || left.order - right.order
    || left.participant.player_id.localeCompare(right.participant.player_id))
  const resultLines = sortedRows.map(row => {
    const name = normalizeSummaryText(row.participant.name)
    const result = formatSignedCny(toCny(row.net, input.exchange_rate))
    if (imported) return `• ${name}: ${result}`
    return `• ${name}: ${formatAmount(row.totalBuyin)} → ${formatAmount(row.participant.final_chips ?? 0)} | ${result}`
  })
  sections.push(`RESULTS\n${resultLines.join('\n')}`)

  const warnings: string[] = []
  if (!imported) {
    for (const row of rows.filter(row => row.participant.buy_ins.length === 0)) {
      warnings.push(`• ${normalizeSummaryText(row.participant.name)} has no buy-in record.`)
    }
  }
  if (totalNet !== 0) warnings.push(`• Session is unbalanced by ${formatSignedChips(totalNet)}.`)
  if (warnings.length > 0) sections.push(`WARNING\n${warnings.join('\n')}`)

  if (totalNet === 0) {
    sections.push(`PAYMENTS\n${formatPayments(rows, input.exchange_rate).join('\n')}`)
  }

  sections.push(`View session details: ${options.detail_url}`)
  return sections.join('\n\n')
}
