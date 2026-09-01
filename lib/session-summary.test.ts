import { describe, expect, it } from 'vitest'
import { buildSessionSummary } from './session-summary'

const detailUrl = 'https://chipindex.example/groups/g1/sessions/s1'

describe('buildSessionSummary', () => {
  it('copies a compact result and grouped payment summary', () => {
    const summary = buildSessionSummary({
      group_name: 'Friday Game',
      date: '2026-08-31',
      description: 'Weekly session',
      exchange_rate: 40,
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
      detail_url: detailUrl,
      format_time: value => value.slice(11, 16),
    })

    expect(summary).toBe(`Friday Game | 2026-08-31
12:03–15:12 · 3 players · 40 chips/¥1 · total buy-in 8,000

RESULTS
• Bob: 2,000 → 3,500 | +¥37.5
• Carol: 2,000 → 2,500 | +¥12.5
• Alice: 4,000 → 2,000 | −¥50

PAYMENTS
• Alice → Bob ¥37.5 + Carol ¥12.5

View session details: https://chipindex.example/groups/g1/sessions/s1`)
    expect(summary).not.toContain('Weekly session')
    expect(summary).not.toContain('EVENTS')
  })

  it('omits synthetic buy-in, final and time data from imported sessions', () => {
    const summary = buildSessionSummary({
      group_name: 'Friday Game',
      date: '2026-08-20',
      description: 'Imported history',
      exchange_rate: 40,
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
    }, { detail_url: detailUrl })

    expect(summary).toBe(`Friday Game | 2026-08-20
3 players · 40 chips/¥1

RESULTS
• Bob: +¥37.5
• Carol: +¥12.5
• Alice: −¥50

PAYMENTS
• Alice → Bob ¥37.5 + Carol ¥12.5

View session details: https://chipindex.example/groups/g1/sessions/s1`)
  })

  it('warns about missing buy-ins and suppresses payments for an unbalanced session', () => {
    const summary = buildSessionSummary({
      group_name: 'Friday\n Game',
      date: '2026-08-31',
      description: null,
      exchange_rate: 40,
      started_at: '2026-08-31T12:00:00.000Z',
      ended_at: '2026-08-31T13:00:00.000Z',
      participants: [{
        player_id: 'alice', name: ' Alice\tSmith ', final_chips: 100, settled_at: '2026-08-31T13:00:00.000Z', buy_ins: [],
      }],
    }, { detail_url: detailUrl, format_time: value => value.slice(11, 16) })

    expect(summary).toContain('Friday Game | 2026-08-31')
    expect(summary).toContain('WARNING\n• Alice Smith has no buy-in record.\n• Session is unbalanced by +100 chips.')
    expect(summary).not.toContain('PAYMENTS')
    expect(summary.endsWith(`View session details: ${detailUrl}`)).toBe(true)
  })

  it('discloses payment rounding without changing result rounding', () => {
    const summary = buildSessionSummary({
      group_name: 'Friday Game', date: '2026-08-31', description: null, exchange_rate: 3,
      started_at: '2026-08-31T12:00:00.000Z', ended_at: '2026-08-31T13:00:00.000Z',
      participants: [
        { player_id: 'alice', name: 'Alice', final_chips: 0, settled_at: '2026-08-31T13:00:00.000Z', buy_ins: [{ amount: 1, created_at: '2026-08-31T12:01:00.000Z' }] },
        { player_id: 'bob', name: 'Bob', final_chips: 0, settled_at: '2026-08-31T13:00:00.000Z', buy_ins: [{ amount: 1, created_at: '2026-08-31T12:02:00.000Z' }] },
        { player_id: 'carol', name: 'Carol', final_chips: 4, settled_at: '2026-08-31T13:00:00.000Z', buy_ins: [{ amount: 2, created_at: '2026-08-31T12:03:00.000Z' }] },
      ],
    }, { detail_url: detailUrl, format_time: value => value.slice(11, 16) })

    expect(summary).toContain('• Alice: 1 → 0 | −¥0.33')
    expect(summary).toContain('• Alice → Carol ¥0.34')
    expect(summary).toContain('• Rounding adjustment: ¥0.01')
  })

  it('keeps zero-result players and states when no payments are needed', () => {
    const summary = buildSessionSummary({
      group_name: 'Heads Up', date: '2026-08-31', description: null, exchange_rate: 40,
      started_at: '2026-08-31T12:00:00.000Z', ended_at: null,
      participants: [
        { player_id: 'alice', name: 'Alice', final_chips: 2000, settled_at: null, buy_ins: [{ amount: 2000, created_at: '2026-08-31T12:00:00.000Z' }] },
      ],
    }, { detail_url: detailUrl, format_time: value => value.slice(11, 16) })

    expect(summary).toContain('12:00 · 1 player · 40 chips/¥1 · total buy-in 2,000')
    expect(summary).toContain('• Alice: 2,000 → 2,000 | ¥0')
    expect(summary).toContain('PAYMENTS\n• No payments required.')
  })

  it('orders multiple payers by loss and each recipient by payment amount', () => {
    const players = [
      ['freeman', 'Freeman', 12_000, 21_480],
      ['ikun', 'iKun', 2_000, 10_200],
      ['li-sen', 'Li Sen', 8_000, 15_100],
      ['yao', 'Yao', 6_000, 6_540],
      ['frank', 'Frank', 2_000, 0],
      ['rong-rong', 'Rong Rong', 14_000, 6_680],
      ['wang-yue', 'Wang Yue', 8_000, 0],
      ['sanjor-yang', 'SanjorYang', 14_000, 6_000],
    ] as const
    const summary = buildSessionSummary({
      group_name: 'Mahjong', date: '2026-08-31', description: null, exchange_rate: 40,
      started_at: '2026-08-31T19:42:00.000Z', ended_at: '2026-08-31T23:37:00.000Z',
      participants: players.map(([player_id, name, buyIn, final_chips], index) => ({
        player_id,
        name,
        final_chips,
        settled_at: '2026-08-31T23:37:00.000Z',
        buy_ins: [{ amount: buyIn, created_at: `2026-08-31T19:${42 + index}:00.000Z` }],
      })),
    }, { detail_url: detailUrl, format_time: value => value.slice(11, 16) })

    expect(summary).toContain('19:42–23:37 · 8 players · 40 chips/¥1 · total buy-in 66,000')
    expect(summary).toContain(`RESULTS
• Freeman: 12,000 → 21,480 | +¥237
• iKun: 2,000 → 10,200 | +¥205
• Li Sen: 8,000 → 15,100 | +¥177.5
• Yao: 6,000 → 6,540 | +¥13.5
• Frank: 2,000 → 0 | −¥50
• Rong Rong: 14,000 → 6,680 | −¥183
• Wang Yue: 8,000 → 0 | −¥200
• SanjorYang: 14,000 → 6,000 | −¥200`)
    expect(summary).toContain(`PAYMENTS
• Wang Yue → Freeman ¥187 + iKun ¥13
• SanjorYang → iKun ¥192 + Yao ¥8
• Rong Rong → Li Sen ¥177.5 + Yao ¥5.5
• Frank → Freeman ¥50`)
  })
})
