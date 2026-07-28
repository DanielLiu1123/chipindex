import { describe, expect, it } from 'vitest'
import { buildResultsBySession } from './session-results'

describe('buildResultsBySession', () => {
  it('aggregates buy-ins by participant while preserving session participant order', () => {
    const results = buildResultsBySession(
      [
        { session_id: 's1', player_id: 'alice', final_chips: 7500 },
        { session_id: 's1', player_id: 'bob', final_chips: 0 },
        { session_id: 's2', player_id: 'alice', final_chips: 2100 },
      ],
      [
        { session_id: 's1', player_id: 'alice', amount: 2000 },
        { session_id: 's1', player_id: 'alice', amount: 2000 },
        { session_id: 's1', player_id: 'alice', amount: 500 },
        { session_id: 's1', player_id: 'bob', amount: 4000 },
      ],
    )

    expect(results.get('s1')).toEqual([
      {
        player_id: 'alice',
        chips: 3000,
        final_chips: 7500,
        total_buyin: 4500,
        buy_in_count: 3,
      },
      {
        player_id: 'bob',
        chips: -4000,
        final_chips: 0,
        total_buyin: 4000,
        buy_in_count: 1,
      },
    ])
    expect(results.get('s2')).toEqual([
      {
        player_id: 'alice',
        chips: 2100,
        final_chips: 2100,
        total_buyin: 0,
        buy_in_count: 0,
      },
    ])
  })

  it('uses zero for a null final chip count while preserving the raw value', () => {
    const results = buildResultsBySession(
      [{ session_id: 's1', player_id: 'alice', final_chips: null }],
      [{ session_id: 's1', player_id: 'alice', amount: 2000 }],
    )

    expect(results.get('s1')).toEqual([
      {
        player_id: 'alice',
        chips: -2000,
        final_chips: null,
        total_buyin: 2000,
        buy_in_count: 1,
      },
    ])
  })
})
