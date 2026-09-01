import { buildPaymentPlan } from './payment-plan'
import { buyinSum, netChips, toCny } from './settlement'
import { formatAmount } from './format'

interface SummaryBuyIn {
  amount: number
  created_at: string
}

interface SummaryParticipant {
  player_id: string
  name: string
  final_chips: number | null
  buy_ins: SummaryBuyIn[]
}

interface SummaryBaseData {
  group_name: string
  date: string
  exchange_rate: number
  participants: SummaryParticipant[]
}

export type SessionSummaryData = SummaryBaseData & (
  | { started_at: null; ended_at: null }
  | { started_at: string; ended_at: string | null }
)

interface SessionSummaryOptions {
  detailUrl: string
  formatTime?: (value: string) => string
}

interface SummaryRow {
  playerId: string
  name: string
  finalChips: number
  totalBuyin: number
  netChips: number
  buyInCount: number
  firstBuyInAt: string | null
  order: number
}

type UnorderedSummaryRow = Omit<SummaryRow, 'order'>

interface PreparedSummary {
  groupName: string
  date: string
  exchangeRate: number
  startedAt: string | null
  endedAt: string | null
  imported: boolean
  rows: SummaryRow[]
  totalBuyin: number
  totalNet: number
}

interface PaymentGroup {
  payer: SummaryRow
  payments: Array<{ recipient: SummaryRow; amountCents: number }>
}

function browserTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function singleLine(value: string): string {
  return value.replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim()
}

function firstBuyInAt(buyIns: SummaryBuyIn[]): string | null {
  return buyIns.reduce<string | null>((first, buyIn) =>
    first === null || buyIn.created_at < first ? buyIn.created_at : first, null)
}

function compareArrival(left: UnorderedSummaryRow, right: UnorderedSummaryRow): number {
  if (left.firstBuyInAt && right.firstBuyInAt) {
    return left.firstBuyInAt.localeCompare(right.firstBuyInAt)
      || left.playerId.localeCompare(right.playerId)
  }
  if (left.firstBuyInAt) return -1
  if (right.firstBuyInAt) return 1
  return left.playerId.localeCompare(right.playerId)
}

function prepareSummary(input: SessionSummaryData): PreparedSummary {
  const rows = input.participants
    .map<UnorderedSummaryRow>(participant => {
      const totalBuyin = buyinSum(participant.buy_ins)
      return {
        playerId: participant.player_id,
        name: singleLine(participant.name),
        finalChips: participant.final_chips ?? 0,
        totalBuyin,
        netChips: netChips(participant.final_chips, totalBuyin),
        buyInCount: participant.buy_ins.length,
        firstBuyInAt: firstBuyInAt(participant.buy_ins),
      }
    })
    .sort(compareArrival)
    .map((row, order) => ({ ...row, order }))

  return {
    groupName: singleLine(input.group_name),
    date: singleLine(input.date),
    exchangeRate: input.exchange_rate,
    startedAt: input.started_at,
    endedAt: input.ended_at,
    imported: input.started_at === null,
    rows,
    totalBuyin: rows.reduce((sum, row) => sum + row.totalBuyin, 0),
    totalNet: rows.reduce((sum, row) => sum + row.netChips, 0),
  }
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

function formatHeader(summary: PreparedSummary, formatTime: (value: string) => string): string {
  const overview: string[] = []
  if (summary.startedAt) {
    const start = formatTime(summary.startedAt)
    overview.push(summary.endedAt ? `${start}–${formatTime(summary.endedAt)}` : start)
  }
  overview.push(`${summary.rows.length} ${summary.rows.length === 1 ? 'player' : 'players'}`)
  overview.push(`${formatAmount(summary.exchangeRate)} chips/¥1`)
  if (!summary.imported) overview.push(`total buy-in ${formatAmount(summary.totalBuyin)}`)
  return `${summary.groupName} | ${summary.date}\n${overview.join(' · ')}`
}

function formatResults(summary: PreparedSummary): string {
  const lines = [...summary.rows]
    .sort((left, right) => right.netChips - left.netChips
      || left.order - right.order
      || left.playerId.localeCompare(right.playerId))
    .map(row => {
      const result = formatSignedCny(toCny(row.netChips, summary.exchangeRate))
      if (summary.imported) return `• ${row.name}: ${result}`
      return `• ${row.name}: ${formatAmount(row.totalBuyin)} → ${formatAmount(row.finalChips)} | ${result}`
    })
  return `RESULTS\n${lines.join('\n')}`
}

function requirePaymentRow(rowsByPlayer: ReadonlyMap<string, SummaryRow>, playerId: string): SummaryRow {
  const row = rowsByPlayer.get(playerId)
  if (!row) throw new Error(`Payment plan referenced unknown player: ${playerId}`)
  return row
}

function buildPaymentGroups(summary: PreparedSummary): { groups: PaymentGroup[]; roundingAdjustmentCents: number } {
  const plan = buildPaymentPlan(summary.rows.map(row => ({
    playerId: row.playerId,
    netChips: row.netChips,
  })), summary.exchangeRate)
  const rowsByPlayer = new Map(summary.rows.map(row => [row.playerId, row]))
  const groupsByPayer = new Map<string, PaymentGroup>()

  // buildPaymentPlan already returns the requested payer/payment ordering, so
  // insertion order is the canonical display order as well.
  for (const transfer of plan.transfers) {
    const payer = requirePaymentRow(rowsByPlayer, transfer.fromPlayerId)
    const group = groupsByPayer.get(payer.playerId) ?? { payer, payments: [] }
    group.payments.push({
      recipient: requirePaymentRow(rowsByPlayer, transfer.toPlayerId),
      amountCents: transfer.amountCents,
    })
    groupsByPayer.set(payer.playerId, group)
  }
  return { groups: [...groupsByPayer.values()], roundingAdjustmentCents: plan.roundingAdjustmentCents }
}

function formatPayments(summary: PreparedSummary): string {
  const { groups, roundingAdjustmentCents } = buildPaymentGroups(summary)
  const lines = groups.length === 0
    ? ['• No payments required.']
    : groups.map(group => {
      const recipients = group.payments
        .map(payment => `${payment.recipient.name} ${formatCents(payment.amountCents)}`)
      return `• ${group.payer.name} → ${recipients.join(' + ')}`
    })
  if (roundingAdjustmentCents > 0) {
    lines.push(`• Rounding adjustment: ${formatCents(roundingAdjustmentCents)}`)
  }
  return `PAYMENTS\n${lines.join('\n')}`
}

function formatWarnings(summary: PreparedSummary): string | null {
  const lines = summary.imported
    ? []
    : summary.rows
        .filter(row => row.buyInCount === 0)
        .map(row => `• ${row.name} has no buy-in record.`)
  if (summary.totalNet !== 0) {
    lines.push(`• Session is unbalanced by ${formatSignedChips(summary.totalNet)}.`)
  }
  return lines.length > 0 ? `WARNING\n${lines.join('\n')}` : null
}

export function buildSessionSummary(input: SessionSummaryData, options: SessionSummaryOptions): string {
  const summary = prepareSummary(input)
  const sections = [
    formatHeader(summary, options.formatTime ?? browserTime),
    formatResults(summary),
  ]
  const warnings = formatWarnings(summary)
  if (warnings) sections.push(warnings)
  if (summary.totalNet === 0) sections.push(formatPayments(summary))
  sections.push(`View session details: ${options.detailUrl}`)
  return sections.join('\n\n')
}
