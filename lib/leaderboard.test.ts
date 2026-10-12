import { expect, it } from 'vitest'
import { buildLeaderboard } from './leaderboard'
import type { LeaderboardSessionRow, Player } from './domain-types'
const players: Player[] = ['a', 'b', 'c'].map((id) => ({
  id,
  name: id,
  created_at: '',
  updated_at: '',
  deleted_at: null,
}))
const session = (
  id: string,
  date: string,
  chips: number,
  rate = 3,
): LeaderboardSessionRow => ({
  id,
  date,
  exchange_rate: rate,
  ended_at: null,
  session_entries: [
    {
      player_id: 'a',
      chips,
      final_chips: 2000 + chips,
      total_buyin: 2000,
      buy_in_count: 1,
    },
  ],
})
const options = {
  range: null,
  hideLowActivity: true,
  chartMode: 'cny',
  sortKey: 'total_yuan',
  sortDir: 'desc',
} as const
it('selects an inclusive cross-year range and rebases curves with the same currency totals', () => {
  const sessions = [
    session('after', '2027-01-02', 900),
    session('end', '2027-01-01', 1),
    session('start', '2026-12-31', 1),
    session('before', '2026-12-30', 900),
  ]
  const result = buildLeaderboard(players, sessions, {
    ...options,
    range: { start: '2026-12-31', end: '2027-01-01' },
  })
  expect(result.sortedStats.map((s) => s.player.id)).toEqual(['a'])
  expect(result.sortedStats[0].total_yuan).toBe(0.67)
  expect(result.chartData).toEqual([
    { session_id: 'start', date: '2026-12-31', a: 0.33 },
    { session_id: 'end', date: '2027-01-01', a: 0.67 },
  ])
  expect(
    buildLeaderboard(players, sessions, {
      ...options,
      range: { start: '2026-12-31', end: '2027-01-01' },
      chartMode: 'chips',
    }).chartData.at(-1)?.a,
  ).toBe(2)
})
it('uses the same visible players for rankings and curves, independently of table sorting', () => {
  const sessions = Array.from({ length: 20 }, (_, index) =>
    session(String(index), `2026-01-${String(index + 1).padStart(2, '0')}`, 1),
  )
  const hidden = buildLeaderboard(players, sessions, options)
  expect(hidden.activityFilter.hiddenCount).toBe(2)
  expect(hidden.chartPlayers.map((p) => p.id)).toEqual(['a'])
  const all = buildLeaderboard(players, sessions, {
    ...options,
    hideLowActivity: false,
  })
  const reversed = buildLeaderboard(players, sessions, {
    ...options,
    hideLowActivity: false,
    sortDir: 'asc',
  })
  expect(all.sortedStats.map((s) => s.player.id)).toEqual(['a', 'b', 'c'])
  expect(reversed.sortedStats.map((s) => s.player.id)).toEqual(['b', 'c', 'a'])
  expect(reversed.chartPlayers).toEqual(all.chartPlayers)
  expect(reversed.chartData).toEqual(all.chartData)
  expect(all.chartData.at(-1)).toMatchObject({ b: 0, c: 0 })
})
it('distinguishes an empty selected range from all-time players without sessions', () => {
  const all = buildLeaderboard(players, [], options)
  expect(all.emptyRange).toBe(false)
  expect(all.playerCount).toBe(3)
  const filtered = buildLeaderboard(players, [], {
    ...options,
    range: { start: '2026-01-01', end: '2026-01-31' },
  })
  expect(filtered.emptyRange).toBe(true)
  expect(filtered.playerCount).toBe(0)
  expect(filtered.activityFilter.hiddenCount).toBe(0)
  expect(filtered.chartData).toEqual([])
})

it('orders same-day cumulative points by end time with missing times first and stable ID ties', () => {
  const sessions = [
    { ...session('late-b', '2026-01-01', 8, 1), ended_at: '2026-01-01T20:00:00Z' },
    { ...session('early', '2026-01-01', -4, 1), ended_at: '2026-01-01T10:00:00Z' },
    { ...session('late-a', '2026-01-01', 2, 1), ended_at: '2026-01-01T20:00:00Z' },
    session('import', '2026-01-01', 1, 1),
  ]
  const result = buildLeaderboard(players, sessions, options)
  expect(result.chartData.map(point => point.a)).toEqual([1, -3, -1, 7])
  expect(result.chartData.map(point => point.session_id)).toEqual(['import', 'early', 'late-a', 'late-b'])
  expect(result.sortedStats.find(stat => stat.player.id === 'a')?.total_yuan).toBe(7)
  expect(sessions.map(row => row.id)).toEqual(['late-b', 'early', 'late-a', 'import'])
})
