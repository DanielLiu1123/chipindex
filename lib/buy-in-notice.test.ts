import { describe, expect, it } from 'vitest'
import { completedBuyInTotals } from './buy-in-notice'
import type { LiveParticipant } from './queries'

function participant(overrides: Partial<LiveParticipant> = {}): LiveParticipant {
  return {
    player_id: 'player-1',
    name: 'Ada',
    total_buyin: 2_000,
    buy_ins: [],
    final_chips: null,
    settled_at: null,
    ...overrides,
  }
}

describe('completed buy-in totals', () => {
  const command = { amount: 2000, entries: [{ id: 'a-new', player_id: 'a' }, { id: 'b-new', player_id: 'b' }] }
  const players = [
    participant({ player_id: 'a', name: 'Alice', total_buyin: 6000, buy_ins: [{ id: 'a-new', player_id: 'a', amount: 2000, created_at: '' }] }),
    participant({ player_id: 'b', name: 'Bob', total_buyin: 4000, buy_ins: [{ id: 'b-new', player_id: 'b', amount: 2000, created_at: '' }] }),
    participant({ player_id: 'c', name: 'Carol' }),
  ]
  it('shows only affected players and uses cumulative totals without double-counting a retry', () => {
    const expected = [{ player_id: 'a', name: 'Alice', total_buyin: 6000 }, { player_id: 'b', name: 'Bob', total_buyin: 4000 }]
    expect(completedBuyInTotals(players, command)).toEqual(expected)
  })
  it('waits until every saved entry is present in refreshed data', () => {
    expect(completedBuyInTotals([players[0]], command)).toBeNull()
    expect(completedBuyInTotals([players[0], { ...players[1], buy_ins: [] }], command)).toBeNull()
  })
})
