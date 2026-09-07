import { describe, expect, it } from 'vitest'
import { activeFinalEntries, isCashedOut, summarizeLiveSession } from './live-session'
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
