import { netChips } from './settlement'

export interface ParticipantResultRow {
  session_id: string
  player_id: string
  final_chips: number | null
}

export interface BuyInResultRow {
  session_id: string
  player_id: string
  amount: number
}

import type { ResultEntry } from './domain-types'

interface BuyInAggregate {
  total: number
  count: number
}

export function buildResultsBySession(
  participants: ParticipantResultRow[],
  buyIns: BuyInResultRow[],
): Map<string, ResultEntry[]> {
  const buyInsBySession = new Map<string, Map<string, BuyInAggregate>>()

  for (const buyIn of buyIns) {
    let buyInsByPlayer = buyInsBySession.get(buyIn.session_id)
    if (!buyInsByPlayer) {
      buyInsByPlayer = new Map<string, BuyInAggregate>()
      buyInsBySession.set(buyIn.session_id, buyInsByPlayer)
    }

    const aggregate = buyInsByPlayer.get(buyIn.player_id) ?? { total: 0, count: 0 }
    aggregate.total += buyIn.amount
    aggregate.count += 1
    buyInsByPlayer.set(buyIn.player_id, aggregate)
  }

  const resultsBySession = new Map<string, ResultEntry[]>()

  for (const participant of participants) {
    const results = resultsBySession.get(participant.session_id) ?? []
    const aggregate = buyInsBySession.get(participant.session_id)?.get(participant.player_id)
    const totalBuyin = aggregate?.total ?? 0

    results.push({
      player_id: participant.player_id,
      chips: netChips(participant.final_chips, totalBuyin),
      final_chips: participant.final_chips,
      total_buyin: totalBuyin,
      buy_in_count: aggregate?.count ?? 0,
    })
    resultsBySession.set(participant.session_id, results)
  }

  return resultsBySession
}

// Group a session's buy-in rows by player, preserving query order.
export function groupByPlayer<T extends { player_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const arr = map.get(row.player_id) ?? []
    arr.push(row)
    map.set(row.player_id, arr)
  }
  return map
}
