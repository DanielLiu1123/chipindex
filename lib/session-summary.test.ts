import { describe, expect, it } from 'vitest'
import { buildSessionSummary, type SessionSummaryData } from './session-summary'

const detailUrl = 'https://chipindex.example/groups/g1/sessions/s1'
type SummaryParticipant = SessionSummaryData['participants'][number]

function player(
  player_id: string,
  name: string,
  final_chips: number | null,
  buy_ins: SummaryParticipant['buy_ins'],
): SummaryParticipant {
  return { player_id, name, final_chips, buy_ins }
}

function liveSession(
  participants: SummaryParticipant[],
  overrides: Partial<{
    group_name: string
    date: string
    exchange_rate: number
    started_at: string
    ended_at: string | null
  }> = {},
): SessionSummaryData {
  return {
    group_name: 'Friday Game',
    date: '2026-08-31',
    exchange_rate: 40,
    started_at: '2026-08-31T12:03:00.000Z',
    ended_at: '2026-08-31T15:12:00.000Z',
    participants,
    ...overrides,
  }
}

function render(summary: SessionSummaryData): string {
  return buildSessionSummary(summary, {
    detailUrl,
    formatTime: value => value.slice(11, 16),
  })
}

describe('buildSessionSummary', () => {
  it('copies a compact result and grouped payment summary', () => {
    const summary = liveSession([
      player('alice', 'Alice', 2000, [
        { amount: 2000, created_at: '2026-08-31T12:04:00.000Z' },
        { amount: 2000, created_at: '2026-08-31T12:42:00.000Z' },
      ]),
      player('bob', 'Bob', 3500, [{ amount: 2000, created_at: '2026-08-31T12:04:30.000Z' }]),
      player('carol', 'Carol', 2500, [{ amount: 2000, created_at: '2026-08-31T12:05:00.000Z' }]),
    ])

    expect(render(summary)).toBe(`Friday Game | 2026-08-31
12:03–15:12 · 3 players · 40 chips/¥1 · total buy-in 8,000

RESULTS
• Bob: 2,000 → 3,500 | +¥37.5
• Carol: 2,000 → 2,500 | +¥12.5
• Alice: 4,000 → 2,000 | −¥50

PAYMENTS
• Alice → Bob ¥37.5 + Carol ¥12.5

View session details: https://chipindex.example/groups/g1/sessions/s1`)
  })

  it('omits synthetic buy-in, final and time data from imported sessions', () => {
    const summary: SessionSummaryData = {
      group_name: 'Friday Game',
      date: '2026-08-20',
      exchange_rate: 40,
      started_at: null,
      ended_at: null,
      participants: [
        player('alice', 'Alice', 2000, [{ amount: 4000, created_at: '2026-08-31T15:12:00.000Z' }]),
        player('bob', 'Bob', 3500, [{ amount: 2000, created_at: '2026-08-31T15:12:00.000Z' }]),
        player('carol', 'Carol', 2500, [{ amount: 2000, created_at: '2026-08-31T15:12:00.000Z' }]),
      ],
    }

    expect(render(summary)).toBe(`Friday Game | 2026-08-20
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
    const summary = liveSession([
      player('alice', ' Alice\tSmith ', 100, []),
    ], {
      group_name: 'Friday\n Game',
      started_at: '2026-08-31T12:00:00.000Z',
      ended_at: '2026-08-31T13:00:00.000Z',
    })

    expect(render(summary)).toBe(`Friday Game | 2026-08-31
12:00–13:00 · 1 player · 40 chips/¥1 · total buy-in 0

RESULTS
• Alice Smith: 0 → 100 | +¥2.5

WARNING
• Alice Smith has no buy-in record.
• Session is unbalanced by +100 chips.

View session details: https://chipindex.example/groups/g1/sessions/s1`)
  })

  it('discloses payment rounding without changing result rounding', () => {
    const summary = liveSession([
      player('alice', 'Alice', 0, [{ amount: 1, created_at: '2026-08-31T12:01:00.000Z' }]),
      player('bob', 'Bob', 0, [{ amount: 1, created_at: '2026-08-31T12:02:00.000Z' }]),
      player('carol', 'Carol', 4, [{ amount: 2, created_at: '2026-08-31T12:03:00.000Z' }]),
    ], {
      exchange_rate: 3,
      started_at: '2026-08-31T12:00:00.000Z',
      ended_at: '2026-08-31T13:00:00.000Z',
    })

    expect(render(summary)).toBe(`Friday Game | 2026-08-31
12:00–13:00 · 3 players · 3 chips/¥1 · total buy-in 4

RESULTS
• Carol: 2 → 4 | +¥0.67
• Alice: 1 → 0 | −¥0.33
• Bob: 1 → 0 | −¥0.33

PAYMENTS
• Alice → Carol ¥0.34
• Bob → Carol ¥0.33
• Rounding adjustment: ¥0.01

View session details: https://chipindex.example/groups/g1/sessions/s1`)
  })

  it('keeps zero-result players and states when no payments are needed', () => {
    const summary = liveSession([
      player('alice', 'Alice', 2000, [{ amount: 2000, created_at: '2026-08-31T12:00:00.000Z' }]),
    ], {
      group_name: 'Heads Up',
      started_at: '2026-08-31T12:00:00.000Z',
      ended_at: null,
    })

    expect(render(summary)).toBe(`Heads Up | 2026-08-31
12:00 · 1 player · 40 chips/¥1 · total buy-in 2,000

RESULTS
• Alice: 2,000 → 2,000 | ¥0

PAYMENTS
• No payments required.

View session details: https://chipindex.example/groups/g1/sessions/s1`)
  })

  it('uses arrival order even when the participant input is shuffled', () => {
    const players = [
      player('freeman', 'Freeman', 21_480, [{ amount: 12_000, created_at: '2026-08-31T19:42:00.000Z' }]),
      player('ikun', 'iKun', 10_200, [{ amount: 2_000, created_at: '2026-08-31T19:43:00.000Z' }]),
      player('li-sen', 'Li Sen', 15_100, [{ amount: 8_000, created_at: '2026-08-31T19:44:00.000Z' }]),
      player('yao', 'Yao', 6_540, [{ amount: 6_000, created_at: '2026-08-31T19:45:00.000Z' }]),
      player('frank', 'Frank', 0, [{ amount: 2_000, created_at: '2026-08-31T19:46:00.000Z' }]),
      player('rong-rong', 'Rong Rong', 6_680, [{ amount: 14_000, created_at: '2026-08-31T19:47:00.000Z' }]),
      player('wang-yue', 'Wang Yue', 0, [{ amount: 8_000, created_at: '2026-08-31T19:48:00.000Z' }]),
      player('sanjor-yang', 'SanjorYang', 6_000, [{ amount: 14_000, created_at: '2026-08-31T19:49:00.000Z' }]),
    ]
    const summary = liveSession(
      [players[6], players[3], players[0], players[7], players[2], players[5], players[1], players[4]],
      {
        group_name: 'Mahjong',
        started_at: '2026-08-31T19:42:00.000Z',
        ended_at: '2026-08-31T23:37:00.000Z',
      },
    )

    expect(render(summary)).toBe(`Mahjong | 2026-08-31
19:42–23:37 · 8 players · 40 chips/¥1 · total buy-in 66,000

RESULTS
• Freeman: 12,000 → 21,480 | +¥237
• iKun: 2,000 → 10,200 | +¥205
• Li Sen: 8,000 → 15,100 | +¥177.5
• Yao: 6,000 → 6,540 | +¥13.5
• Frank: 2,000 → 0 | −¥50
• Rong Rong: 14,000 → 6,680 | −¥183
• Wang Yue: 8,000 → 0 | −¥200
• SanjorYang: 14,000 → 6,000 | −¥200

PAYMENTS
• Wang Yue → Freeman ¥187 + iKun ¥13
• SanjorYang → iKun ¥192 + Yao ¥8
• Rong Rong → Li Sen ¥177.5 + Yao ¥5.5
• Frank → Freeman ¥50

View session details: https://chipindex.example/groups/g1/sessions/s1`)
  })
})
