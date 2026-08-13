import { describe, it, expect } from 'vitest'
import { computeLeaderboardStats, computePlayerHistory, filterLowActivityPlayers } from './stats'
import type { PlayerStats } from './stats'
import type {
  LeaderboardSessionRow,
  PlayerDetail,
  PlayerHistoryEntry,
} from './queries'
import type { GroupPlayer, Player } from '@/types'

const players: Player[] = [
  { id: 'alice', name: 'Alice', created_at: '2026-01-01' },
  { id: 'bob', name: 'Bob', created_at: '2026-01-01' },
  { id: 'carol', name: 'Carol', created_at: '2026-01-01' },
]

function groupPlayer(player: Player): { player: Player; group_player: GroupPlayer } {
  return {
    player,
    group_player: {
      id: `gp-${player.id}`,
      group_id: 'g1',
      player_id: player.id,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      deleted_at: null,
    },
  }
}

const sessions: LeaderboardSessionRow[] = [
  {
    id: 's1',
    date: '2026-01-10',
    exchange_rate: 40,
    session_entries: [
      { player_id: 'alice', chips: 4000, final_chips: 6000, total_buyin: 2000, buy_in_count: 1 },
      { player_id: 'bob', chips: -4000, final_chips: 0, total_buyin: 4000, buy_in_count: 2 },
    ],
  },
  {
    id: 's2',
    date: '2026-01-17',
    exchange_rate: 40,
    session_entries: [
      { player_id: 'alice', chips: -2000, final_chips: 0, total_buyin: 2000, buy_in_count: 1 },
      { player_id: 'bob', chips: 2000, final_chips: 4000, total_buyin: 2000, buy_in_count: 1 },
    ],
  },
]

interface EntryOptions {
  session_id: string
  date?: string
  started_at?: string | null
  chips?: number
  total_buyin?: number
  buy_in_count?: number
  final_chips?: number | null
  exchange_rate?: number
}

function makeEntry({
  session_id,
  date = '2026-02-01',
  started_at = null,
  chips = 0,
  total_buyin = 2000,
  buy_in_count = 1,
  final_chips,
  exchange_rate = 40,
}: EntryOptions): PlayerHistoryEntry {
  const resolvedFinal = final_chips === undefined ? total_buyin + chips : final_chips
  const resultEntry = {
    player_id: 'alice',
    chips,
    final_chips: resolvedFinal,
    total_buyin,
    buy_in_count,
  }

  return {
    session_id,
    chips,
    final_chips: resolvedFinal,
    total_buyin,
    buy_in_count,
    sessions: {
      id: session_id,
      date,
      description: null,
      exchange_rate,
      started_at,
      session_entries: [resultEntry],
    },
  }
}

function makePlayerDetail(entries: PlayerHistoryEntry[]): PlayerDetail {
  return { id: 'alice', name: 'Alice', group_player: groupPlayer(players[0]).group_player, entries }
}

describe('computeLeaderboardStats', () => {
  const stats = computeLeaderboardStats(players.map(groupPlayer), sessions)

  it('accumulates chips and CNY per player', () => {
    const alice = stats.find(s => s.player.id === 'alice')!
    expect(alice.total_chips).toBe(2000)
    expect(alice.total_yuan).toBe(50)
    expect(alice.sessions_played).toBe(2)
  })

  it('counts wins and POG per session', () => {
    const alice = stats.find(s => s.player.id === 'alice')!
    const bob = stats.find(s => s.player.id === 'bob')!
    expect(alice.wins).toBe(1)
    expect(alice.pog_count).toBe(1)
    expect(bob.wins).toBe(1)
    expect(bob.pog_count).toBe(1)
  })

  it('leaves players with no sessions at zero', () => {
    const carol = stats.find(s => s.player.id === 'carol')!
    expect(carol.sessions_played).toBe(0)
    expect(carol.win_rate).toBe(0)
  })

  it('sorts by CNY descending', () => {
    expect(stats.map(s => s.player.id)).toEqual(['alice', 'carol', 'bob'])
  })
})

describe('filterLowActivityPlayers', () => {
  function playerStats(name: string, sessionsPlayed: number): PlayerStats {
    return {
      player: { id: name.toLowerCase(), name, created_at: '2026-01-01' },
      group_player: groupPlayer({ id: name.toLowerCase(), name, created_at: '2026-01-01' }).group_player,
      total_chips: 0,
      total_yuan: 0,
      sessions_played: sessionsPlayed,
      wins: 0,
      win_rate: 0,
      pog_count: 0,
    }
  }

  it('hides players strictly below one tenth of the maximum rounded down', () => {
    const stats = [
      playerStats('Max', 52),
      playerStats('Boundary', 5),
      playerStats('Below', 4),
      playerStats('Never', 0),
    ]

    const result = filterLowActivityPlayers(stats)

    expect(result.threshold).toBe(5)
    expect(result.visibleStats.map(stat => stat.player.name)).toEqual(['Max', 'Boundary'])
    expect(result.hiddenCount).toBe(2)
    expect(stats).toHaveLength(4)
  })

  it('keeps every player when the maximum is below ten sessions', () => {
    const stats = [playerStats('Max', 9), playerStats('Never', 0)]

    const result = filterLowActivityPlayers(stats)

    expect(result.threshold).toBe(0)
    expect(result.visibleStats).toEqual(stats)
    expect(result.hiddenCount).toBe(0)
  })

  it('handles an empty leaderboard', () => {
    expect(filterLowActivityPlayers([])).toEqual({
      threshold: 0,
      visibleStats: [],
      hiddenCount: 0,
    })
  })
})

describe('computePlayerHistory', () => {
  const detail: PlayerDetail = {
    id: 'alice',
    name: 'Alice',
    group_player: groupPlayer(players[0]).group_player,
    entries: [
      {
        session_id: 's2',
        chips: -2000,
        final_chips: 0,
        total_buyin: 2000,
        buy_in_count: 1,
        sessions: {
          id: 's2',
          date: '2026-01-17',
          description: null,
          exchange_rate: 40,
          started_at: '2026-01-17T12:00:00Z',
          session_entries: sessions[1].session_entries,
        },
      },
      {
        session_id: 's1',
        chips: 4000,
        final_chips: 6000,
        total_buyin: 2000,
        buy_in_count: 1,
        sessions: {
          id: 's1',
          date: '2026-01-10',
          description: 'first game',
          exchange_rate: 40,
          started_at: '2026-01-10T12:00:00Z',
          session_entries: sessions[0].session_entries,
        },
      },
    ],
  }

  const history = computePlayerHistory(detail)

  it('orders points by date and accumulates totals', () => {
    expect(history.history.map(h => h.session_id)).toEqual(['s1', 's2'])
    expect(history.history[1].cumulative).toBe(2000)
    expect(history.history[1].cumulative_cny).toBe(50)
  })

  it('reports summary totals from the last point', () => {
    expect(history.totalChips).toBe(2000)
    expect(history.totalCny).toBe(50)
    expect(history.wins).toBe(1)
    expect(history.pogCount).toBe(1)
  })

  it('builds contiguous chips and CNY candles from actual buy-ins', () => {
    expect(history.history[0].chips_candle).toEqual({
      open: 0,
      high: 4000,
      low: -2000,
      close: 4000,
    })
    expect(history.history[1].chips_candle).toEqual({
      open: 4000,
      high: 4000,
      low: 2000,
      close: 2000,
    })
    expect(history.history[0].cny_candle).toEqual({
      open: 0,
      high: 100,
      low: -50,
      close: 100,
    })
    expect(history.history[1].cny_candle).toEqual({
      open: 100,
      high: 100,
      low: 50,
      close: 50,
    })

    expect(history.history[0].chips_candle.close).toBe(history.history[1].chips_candle.open)
    expect(history.history[0].cny_candle.close).toBe(history.history[1].cny_candle.open)

    for (const point of history.history) {
      for (const candle of [point.chips_candle, point.cny_candle]) {
        expect(candle.low).toBeLessThanOrEqual(Math.min(candle.open, candle.close))
        expect(candle.high).toBeGreaterThanOrEqual(Math.max(candle.open, candle.close))
      }
    }
  })

  it('orders same-day sessions by valid start time, then session id, with missing times last', () => {
    const sameDay = makePlayerDetail([
      makeEntry({ session_id: 'null-b', started_at: null }),
      makeEntry({ session_id: 'late', started_at: '2026-02-01T20:00:00+08:00' }),
      makeEntry({ session_id: 'early', started_at: '2026-02-01T10:00:00+08:00' }),
      makeEntry({ session_id: 'same-b', started_at: '2026-02-01T12:00:00+08:00' }),
      makeEntry({ session_id: 'same-a', started_at: '2026-02-01T12:00:00+08:00' }),
      makeEntry({ session_id: 'null-a', started_at: 'invalid' }),
    ])

    expect(computePlayerHistory(sameDay).history.map(point => point.session_id)).toEqual([
      'early',
      'same-a',
      'same-b',
      'late',
      'null-a',
      'null-b',
    ])
  })

  it('sorts all missing same-day start times by session id', () => {
    const missing = makePlayerDetail([
      makeEntry({ session_id: 'b', started_at: null }),
      makeEntry({ session_id: 'a', started_at: null }),
    ])

    expect(computePlayerHistory(missing).history.map(point => point.session_id)).toEqual(['a', 'b'])
  })

  it('keeps date as the primary history sort key', () => {
    const differentDates = makePlayerDetail([
      makeEntry({
        session_id: 'later-date',
        date: '2026-02-02',
        started_at: '2026-01-01T01:00:00Z',
      }),
      makeEntry({
        session_id: 'earlier-date',
        date: '2026-02-01',
        started_at: '2026-12-31T23:00:00Z',
      }),
    ])

    expect(computePlayerHistory(differentDates).history.map(point => point.session_id)).toEqual([
      'earlier-date',
      'later-date',
    ])
  })

  it('uses actual non-standard buy-ins and preserves tiny CNY doji data', () => {
    const custom = makePlayerDetail([
      makeEntry({
        session_id: 'custom-buyin',
        chips: 500,
        total_buyin: 4500,
        buy_in_count: 3,
        final_chips: 5000,
        exchange_rate: 40,
      }),
      makeEntry({
        session_id: 'tiny-win',
        date: '2026-02-02',
        chips: 1,
        total_buyin: 2000,
        final_chips: 2001,
        exchange_rate: 1000,
      }),
    ])
    const customHistory = computePlayerHistory(custom).history

    expect(customHistory[0]).toMatchObject({
      buy_in_count: 3,
      total_buyin: 4500,
      final_chips: 5000,
    })
    expect(customHistory[0].chips_candle.low).toBe(-4500)
    expect(customHistory[0].cny_candle.low).toBe(-112.5)
    expect(customHistory[1].chips).toBe(1)
    expect(customHistory[1].cny).toBe(0)
    expect(customHistory[1].cny_candle.open).toBe(customHistory[1].cny_candle.close)
  })

  it('normalizes player history net values from final chips and total buy-in', () => {
    const result = computePlayerHistory(makePlayerDetail([
      makeEntry({
        session_id: 'null-final',
        chips: 1,
        total_buyin: 2000,
        final_chips: null,
        exchange_rate: 40,
      }),
    ]))
    const point = result.history[0]

    expect(point.chips).toBe(-2000)
    expect(point.cny).toBe(-50)
    expect(point.chips_candle).toEqual({ open: 0, high: 0, low: -2000, close: -2000 })
    expect(point.cny_candle).toEqual({ open: 0, high: 0, low: -50, close: -50 })
    expect(point.cumulative).toBe(point.chips_candle.close)
    expect(point.cumulative_cny).toBe(point.cny_candle.close)
    expect(result.totalChips).toBe(point.chips_candle.close)
    expect(result.totalCny).toBe(point.cny_candle.close)
    expect(result.wins).toBe(0)
    expect(result.pogCount).toBe(1)
  })

  it('computes POG from normalized settlement net values', () => {
    const entry = makeEntry({
      session_id: 'normalized-pog',
      chips: 1000,
      total_buyin: 2000,
      final_chips: 2000,
    })
    entry.sessions.session_entries = [
      {
        player_id: 'alice',
        chips: 1000,
        final_chips: 2000,
        total_buyin: 2000,
        buy_in_count: 1,
      },
      {
        player_id: 'bob',
        chips: 0,
        final_chips: 3000,
        total_buyin: 2000,
        buy_in_count: 1,
      },
    ]

    const result = computePlayerHistory(makePlayerDetail([entry]))

    expect(result.history[0].chips).toBe(0)
    expect(result.pogCount).toBe(0)
  })

  it('builds a neutral doji for a true tie at a different exchange rate', () => {
    const tie = computePlayerHistory(makePlayerDetail([
      makeEntry({
        session_id: 'tie',
        chips: 0,
        total_buyin: 2000,
        final_chips: 2000,
        exchange_rate: 20,
      }),
    ])).history[0]

    expect(tie.chips_candle).toEqual({ open: 0, high: 0, low: -2000, close: 0 })
    expect(tie.cny_candle).toEqual({ open: 0, high: 0, low: -100, close: 0 })
  })
})
