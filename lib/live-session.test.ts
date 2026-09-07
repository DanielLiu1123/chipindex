import { describe, expect, it } from 'vitest'
import { activeFinalEntries, completedBuyInTotals, isCashedOut, summarizeLiveSession } from './live-session'
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

describe('live session model', () => {
  it('treats settled_at as the cash-out boundary', () => {
    expect(isCashedOut(participant())).toBe(false)
    expect(isCashedOut(participant({ settled_at: '2026-08-19T10:00:00Z' }))).toBe(true)
  })

  it('keeps cashed-out chips frozen while combining active drafts', () => {
    const participants = [
      participant({ player_id: 'active', total_buyin: 2_000 }),
      participant({
        player_id: 'locked',
        total_buyin: 2_000,
        final_chips: 3_000,
        settled_at: '2026-08-19T10:00:00Z',
      }),
    ]

    expect(summarizeLiveSession(participants, { active: '1000', locked: '9999' })).toEqual({
      pot: 4_000,
      cashedOutTotal: 3_000,
      totalFinal: 4_000,
      settleDiff: 0,
      allFinalsFilled: true,
    })
    expect(activeFinalEntries(participants, { active: '1000', locked: '9999' })).toEqual([
      { player_id: 'active', final_chips: 1_000 },
    ])
  })

  it('marks settlement incomplete until every active player has a draft', () => {
    const participants = [participant({ player_id: 'a' }), participant({ player_id: 'b' })]
    expect(summarizeLiveSession(participants, { a: '0' }).allFinalsFilled).toBe(false)
    expect(summarizeLiveSession(participants, { a: '0', b: '2000' }).allFinalsFilled).toBe(true)
  })
})


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
    expect(completedBuyInTotals(players, command)).toEqual(expected)
  })
  it('waits until every saved entry is present in refreshed data', () => {
    expect(completedBuyInTotals([players[0]], command)).toBeNull()
    expect(completedBuyInTotals([players[0], { ...players[1], buy_ins: [] }], command)).toBeNull()
  })
})
