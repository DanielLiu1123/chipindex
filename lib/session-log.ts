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

export function buildSessionLog(input: SessionLogInput, formatTime: TimeFormatter): string[] {
  const orderByPlayer = participantOrder(input.participants)
  const events: EffectiveEvent[] = [{
    occurred_at: input.started_at,
    rank: 0,
    player_order: -1,
    text: 'Session started',
  }]

  for (const participant of input.participants) {
    const name = normalizeSummaryText(participant.name)
    const playerOrder = orderByPlayer.get(participant.player_id) ?? Number.MAX_SAFE_INTEGER
    const buyIns = [...participant.buy_ins].sort((a, b) => a.created_at.localeCompare(b.created_at))
    buyIns.forEach((buyIn, index) => events.push({
      occurred_at: buyIn.created_at,
      rank: index === 0 ? 1 : 2,
      player_order: playerOrder,
      text: index === 0
        ? `${name} joined · buy-in ${buyIn.amount.toLocaleString('en-US')}`
        : `${name} buy-in · +${buyIn.amount.toLocaleString('en-US')}`,
    }))
    if (isEarlyCashOut(participant.settled_at, input.ended_at)) {
      events.push({
        occurred_at: participant.settled_at,
        rank: 3,
        player_order: playerOrder,
        text: `${name} cashed out · ${(participant.final_chips ?? 0).toLocaleString('en-US')}`,
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
