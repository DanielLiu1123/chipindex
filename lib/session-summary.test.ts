import { describe, expect, it } from 'vitest'
import { buildSessionSummary } from './session-summary'

const detailUrl = 'https://chipindex.example/groups/g1/sessions/s1'

describe('buildSessionSummary', () => {
  it('copies the effective live events, results and minimum payment plan', () => {
    const summary = buildSessionSummary({
      group_name: 'Friday Game',
      date: '2026-08-31',
      description: 'Weekly session',
      exchange_rate: 40,
      detail_url: detailUrl,
      started_at: '2026-08-31T12:03:00.000Z',
      ended_at: '2026-08-31T15:12:00.000Z',
      participants: [
        {
          player_id: 'alice', name: 'Alice', final_chips: 2000, settled_at: '2026-08-31T15:12:00.000Z',
          buy_ins: [
            { amount: 2000, created_at: '2026-08-31T12:04:00.000Z' },
            { amount: 2000, created_at: '2026-08-31T12:42:00.000Z' },
          ],
        },
        {
          player_id: 'bob', name: 'Bob', final_chips: 3500, settled_at: '2026-08-31T14:05:00.000Z',
          buy_ins: [{ amount: 2000, created_at: '2026-08-31T12:04:30.000Z' }],
        },
        {
          player_id: 'carol', name: 'Carol', final_chips: 2500, settled_at: '2026-08-31T15:12:00.000Z',
          buy_ins: [{ amount: 2000, created_at: '2026-08-31T12:05:00.000Z' }],
        },
      ],
    }, {
      format_time: value => value.slice(11, 16),
    })

    expect(summary).toBe(`Friday Game
2026-08-31 · Weekly session
40 chips = ¥1
3 players · total buy-in 8,000 chips

EVENTS
12:03 Session started with Alice · buy-in 2,000
12:04 Bob joined · buy-in 2,000
12:05 Carol joined · buy-in 2,000
12:42 Alice buy-in · +2,000
14:05 Bob cashed out · 3,500
15:12 Session ended

RESULTS
Bob · buy-in 2,000 (1x) · final 3,500 · +1,500 chips · +¥37.5
Carol · buy-in 2,000 (1x) · final 2,500 · +500 chips · +¥12.5
Alice · buy-in 4,000 (2x) · final 2,000 · -2,000 chips · -¥50

PAYMENTS
Alice → Bob · ¥37.5
Alice → Carol · ¥12.5

Session details: https://chipindex.example/groups/g1/sessions/s1`)
  })

  it('does not present synthesized import rows as live events or buy-in history', () => {
    const summary = buildSessionSummary({
      group_name: 'Friday Game',
      date: '2026-08-20',
      description: 'Imported history',
      exchange_rate: 40,
      detail_url: detailUrl,
      started_at: null,
      ended_at: null,
      participants: [
        {
          player_id: 'alice', name: 'Alice', final_chips: 2000, settled_at: '2026-08-31T15:12:00.000Z',
          buy_ins: [{ amount: 4000, created_at: '2026-08-31T15:12:00.000Z' }],
        },
        {
          player_id: 'bob', name: 'Bob', final_chips: 3500, settled_at: '2026-08-31T15:12:00.000Z',
          buy_ins: [{ amount: 2000, created_at: '2026-08-31T15:12:00.000Z' }],
        },
        {
          player_id: 'carol', name: 'Carol', final_chips: 2500, settled_at: '2026-08-31T15:12:00.000Z',
          buy_ins: [{ amount: 2000, created_at: '2026-08-31T15:12:00.000Z' }],
        },
      ],
    })

    expect(summary).toContain('3 players\n\nImported session · no live event log.')
    expect(summary).not.toContain('EVENTS')
    expect(summary).not.toContain('buy-in 4,000')
    expect(summary).toContain('Alice · -2,000 chips · -¥50')
    expect(summary).toContain('Alice → Bob · ¥37.5')
    expect(summary.endsWith(`Session details: ${detailUrl}`)).toBe(true)
  })

  it('warns about missing buy-ins and suppresses payments for an unbalanced session', () => {
    const summary = buildSessionSummary({
      group_name: 'Friday\n Game',
      date: '2026-08-31',
      description: null,
      exchange_rate: 40,
      detail_url: detailUrl,
      started_at: '2026-08-31T12:00:00.000Z',
      ended_at: '2026-08-31T13:00:00.000Z',
      participants: [{
        player_id: 'alice', name: ' Alice\tSmith ', final_chips: 100, settled_at: '2026-08-31T13:00:00.000Z', buy_ins: [],
      }],
    }, { format_time: value => value.slice(11, 16) })

    expect(summary).toContain('Friday Game')
    expect(summary).toContain('WARNING\nAlice Smith has no buy-in record.\nSession is unbalanced by +100 chips.')
    expect(summary).not.toContain('PAYMENTS')
    expect(summary.endsWith(`Session details: ${detailUrl}`)).toBe(true)
  })

  it('discloses payment rounding without changing result rounding', () => {
    const summary = buildSessionSummary({
      group_name: 'Friday Game', date: '2026-08-31', description: null, exchange_rate: 3, detail_url: detailUrl,
      started_at: '2026-08-31T12:00:00.000Z', ended_at: '2026-08-31T13:00:00.000Z',
      participants: [
        { player_id: 'alice', name: 'Alice', final_chips: 0, settled_at: '2026-08-31T13:00:00.000Z', buy_ins: [{ amount: 1, created_at: '2026-08-31T12:01:00.000Z' }] },
        { player_id: 'bob', name: 'Bob', final_chips: 0, settled_at: '2026-08-31T13:00:00.000Z', buy_ins: [{ amount: 1, created_at: '2026-08-31T12:02:00.000Z' }] },
        { player_id: 'carol', name: 'Carol', final_chips: 4, settled_at: '2026-08-31T13:00:00.000Z', buy_ins: [{ amount: 2, created_at: '2026-08-31T12:03:00.000Z' }] },
      ],
    }, { format_time: value => value.slice(11, 16) })

    expect(summary).toContain('Alice · buy-in 1 (1x) · final 0 · -1 chips · -¥0.33')
    expect(summary).toContain('Alice → Carol · ¥0.34')
    expect(summary).toContain('Includes a ¥0.01 rounding adjustment.')
    expect(summary.endsWith(`Session details: ${detailUrl}`)).toBe(true)
  })
})
