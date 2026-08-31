import { formatAmount } from './format'

export interface SummaryBuyIn {
  amount: number
  created_at: string
}

export interface SummaryParticipant {
  player_id: string
  name: string
  final_chips: number | null
  settled_at: string | null
  buy_ins: SummaryBuyIn[]
}

export interface SessionLogInput {
  started_at: string
  ended_at: string | null
  participants: SummaryParticipant[]
}

interface EffectiveEvent {
  occurred_at: string
  rank: number
  player_order: number
  text: string
}

interface BuyInCluster {
  occurred_at: string
  amount: number
  count: number
}

export type TimeFormatter = (value: string) => string

export function normalizeSummaryText(value: string): string {
  return value.replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim()
}

export function participantOrder(participants: SummaryParticipant[]): Map<string, number> {
  const sorted = [...participants].sort((a, b) => {
    const firstA = [...a.buy_ins].sort((left, right) => left.created_at.localeCompare(right.created_at))[0]?.created_at
    const firstB = [...b.buy_ins].sort((left, right) => left.created_at.localeCompare(right.created_at))[0]?.created_at
    if (firstA && firstB) return firstA.localeCompare(firstB) || a.player_id.localeCompare(b.player_id)
    if (firstA) return -1
    if (firstB) return 1
    return a.player_id.localeCompare(b.player_id)
  })
  return new Map(sorted.map((participant, index) => [participant.player_id, index]))
}

function isEarlyCashOut(settledAt: string | null, endedAt: string | null): settledAt is string {
  if (!settledAt) return false
  if (!endedAt) return true
  return Date.parse(settledAt) < Date.parse(endedAt)
}

function formatNameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return names.join(' and ')
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

function clusterBuyIns(buyIns: SummaryBuyIn[]): BuyInCluster[] {
  const clusters: BuyInCluster[] = []
  for (const buyIn of buyIns) {
    const current = clusters.at(-1)
    if (current && Date.parse(buyIn.created_at) <= Date.parse(current.occurred_at) + 60_000) {
      current.amount += buyIn.amount
      current.count++
    } else {
      clusters.push({ occurred_at: buyIn.created_at, amount: buyIn.amount, count: 1 })
    }
  }
  return clusters
}

function sessionStartedText(initialPlayers: Array<{ name: string; amount: number }>): string {
  if (initialPlayers.length === 0) return 'Session started'
  const sameAmount = initialPlayers.every(player => player.amount === initialPlayers[0].amount)
  if (sameAmount) {
    const each = initialPlayers.length > 1 ? ' each' : ''
    return `Session started with ${formatNameList(initialPlayers.map(player => player.name))} · buy-in ${formatAmount(initialPlayers[0].amount)}${each}`
  }
  return `Session started with ${formatNameList(initialPlayers.map(player =>
    `${player.name} (${formatAmount(player.amount)})`))}`
}

export function buildSessionLog(input: SessionLogInput, formatTime: TimeFormatter): string[] {
  const orderByPlayer = participantOrder(input.participants)
  const prepared = input.participants.map(participant => ({
    participant,
    name: normalizeSummaryText(participant.name),
    playerOrder: orderByPlayer.get(participant.player_id) ?? Number.MAX_SAFE_INTEGER,
    buyIns: [...participant.buy_ins].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  }))
  const startedAt = Date.parse(input.started_at)
  const initialPlayerIds = new Set(prepared.filter(({ buyIns }) => {
    const joinedAt = Date.parse(buyIns[0]?.created_at ?? '')
    return joinedAt >= startedAt && joinedAt <= startedAt + 60_000
  }).map(({ participant }) => participant.player_id))
  const initialPlayers = prepared
    .filter(({ participant }) => initialPlayerIds.has(participant.player_id))
    .sort((a, b) => a.playerOrder - b.playerOrder)
    .map(({ name, buyIns }) => ({ name, amount: buyIns[0].amount }))
  const events: EffectiveEvent[] = [{
    occurred_at: input.started_at,
    rank: 0,
    player_order: -1,
    text: sessionStartedText(initialPlayers),
  }]

  for (const { participant, name, playerOrder, buyIns } of prepared) {
    const firstBuyIn = buyIns[0]
    if (firstBuyIn && !initialPlayerIds.has(participant.player_id)) {
      events.push({
        occurred_at: firstBuyIn.created_at,
        rank: 1,
        player_order: playerOrder,
        text: `${name} joined · buy-in ${formatAmount(firstBuyIn.amount)}`,
      })
    }
    for (const cluster of clusterBuyIns(buyIns.slice(1))) events.push({
      occurred_at: cluster.occurred_at,
      rank: 2,
      player_order: playerOrder,
      text: `${name} buy-in · +${formatAmount(cluster.amount)}${cluster.count > 1 ? ` (${cluster.count}x)` : ''}`,
    })
    if (isEarlyCashOut(participant.settled_at, input.ended_at)) {
      events.push({
        occurred_at: participant.settled_at,
        rank: 3,
        player_order: playerOrder,
        text: `${name} cashed out · ${formatAmount(participant.final_chips ?? 0)}`,
      })
    }
  }

  if (input.ended_at) {
    events.push({
      occurred_at: input.ended_at,
      rank: 4,
      player_order: Number.MAX_SAFE_INTEGER,
      text: 'Session ended',
    })
  }

  return events
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)
      || a.rank - b.rank
      || a.player_order - b.player_order
      || a.text.localeCompare(b.text))
    .map(event => `${formatTime(event.occurred_at)} ${event.text}`)
}
