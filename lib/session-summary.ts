import { buildPaymentPlan } from './payment-plan'
import {
  buildSessionLog,
  normalizeSummaryText,
  participantOrder,
  type SummaryParticipant,
  type TimeFormatter,
} from './session-log'
import { buyinSum, netChips, toCny } from './settlement'

export interface SessionSummaryInput {
  group_name: string
  date: string
  description: string | null
  exchange_rate: number
  started_at: string | null
  ended_at: string | null
  participants: SummaryParticipant[]
}

export interface SessionSummaryOptions {
  format_time?: TimeFormatter
}

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

function tableCell(value: string): string {
  return value.replace(/\|/g, '\\|')
}

function markdownTable(
  headers: string[],
  alignments: Array<'left' | 'right'>,
  rows: string[][],
): string {
  const renderRow = (cells: string[]) => `| ${cells.map(tableCell).join(' | ')} |`
  const separator = alignments.map(alignment => alignment === 'right' ? '---:' : ':---')
  return [renderRow(headers), renderRow(separator), ...rows.map(renderRow)].join('\n')
}

function browserTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function formatSignedChips(value: number): string {
  if (value > 0) return `+${value.toLocaleString('en-US')} chips`
  if (value < 0) return `-${Math.abs(value).toLocaleString('en-US')} chips`
  return '0 chips'
}

function formatSignedCny(value: number): string {
  if (value > 0) return `+¥${numberFormat.format(value)}`
  if (value < 0) return `-¥${numberFormat.format(Math.abs(value))}`
  return '¥0'
}

function formatCents(value: number): string {
  return `¥${numberFormat.format(value / 100)}`
}

export function buildSessionSummary(
  input: SessionSummaryInput,
  options: SessionSummaryOptions = {},
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
    `${numberFormat.format(input.exchange_rate)} chips = ¥1`,
    imported
      ? `${rows.length} ${rows.length === 1 ? 'player' : 'players'}`
      : `${rows.length} ${rows.length === 1 ? 'player' : 'players'} · total buy-in ${totalBuyin.toLocaleString('en-US')} chips`,
  ]
  const sections: string[] = [header.join('\n')]

  if (input.started_at === null) {
    sections.push('Imported session · no live event log.')
  } else {
    const eventRows = buildSessionLog({
      started_at: input.started_at,
      ended_at: input.ended_at,
      participants: input.participants,
    }, options.format_time ?? browserTime).map(line => {
      const separator = line.indexOf(' ')
      return [line.slice(0, separator), line.slice(separator + 1)]
    })
    sections.push(`EVENTS\n${markdownTable(['TIME', 'EVENT'], ['right', 'left'], eventRows)}`)
  }

  const sortedRows = [...rows].sort((a, b) => b.net - a.net
    || a.order - b.order
    || a.participant.player_id.localeCompare(b.participant.player_id))
  const resultRows = sortedRows.map(row => {
    const name = normalizeSummaryText(row.participant.name)
    const net = formatSignedChips(row.net)
    const cny = formatSignedCny(toCny(row.net, input.exchange_rate))
    if (imported) return [name, net, cny]
    return [
      name,
      `${row.totalBuyin.toLocaleString('en-US')} (${row.participant.buy_ins.length}x)`,
      (row.participant.final_chips ?? 0).toLocaleString('en-US'),
      net,
      cny,
    ]
  })
  sections.push(imported
    ? `RESULTS\n${markdownTable(['PLAYER', 'NET', 'CNY'], ['left', 'right', 'right'], resultRows)}`
    : `RESULTS\n${markdownTable(
      ['PLAYER', 'BUY-IN', 'FINAL', 'NET', 'CNY'],
      ['left', 'right', 'right', 'right', 'right'],
      resultRows,
    )}`)

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
      player_id: row.participant.player_id,
      net_chips: row.net,
      order: row.order,
    })), input.exchange_rate)
    const names = new Map(rows.map(row => [row.participant.player_id, normalizeSummaryText(row.participant.name)]))
    const payments = plan.transfers.length === 0
      ? 'No transfers required.'
      : markdownTable(
        ['FROM', 'TO', 'AMOUNT'],
        ['left', 'left', 'right'],
        plan.transfers.map(transfer => [
          names.get(transfer.from_player_id) ?? transfer.from_player_id,
          names.get(transfer.to_player_id) ?? transfer.to_player_id,
          formatCents(transfer.amount_cents),
        ]),
      )
    if (plan.rounding_adjustment_cents > 0) {
      sections.push(`PAYMENTS\n${payments}\n\nIncludes a ${formatCents(plan.rounding_adjustment_cents)} rounding adjustment.`)
    } else {
      sections.push(`PAYMENTS\n${payments}`)
    }
  }

  return sections.join('\n\n')
}
