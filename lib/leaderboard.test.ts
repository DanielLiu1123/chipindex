import { expect, it } from 'vitest'
import { leaderboardStatsForRange, buildChartData, sortLeaderboard } from './leaderboard'
import { filterLowActivityPlayers } from './stats'
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
it('selects an inclusive cross-year range and rebases curves with the same currency totals', () => {
  const sessions = [
    session('after', '2027-01-02', 900),
    session('end', '2027-01-01', 1),
    session('start', '2026-12-31', 1),
    session('before', '2026-12-30', 900),
  ]
  const result = leaderboardStatsForRange(players, sessions, { start: '2026-12-31', end: '2027-01-01' })
  expect(result.stats.map(s => s.player.id)).toEqual(['a'])
  expect(result.stats[0].total_yuan).toBe(0.67)
  expect(buildChartData(result.sessions, result.stats, 'cny')).toEqual([
    { session_id: 'start', date: '2026-12-31', a: 0.33 },
    { session_id: 'end', date: '2027-01-01', a: 0.67 },
  ])
  expect(buildChartData(result.sessions, result.stats, 'chips').at(-1)?.a).toBe(2)
})
it('uses the same visible players for rankings and curves, independently of table sorting', () => {
  const sessions = Array.from({ length: 20 }, (_, index) =>
    session(String(index), `2026-01-${String(index + 1).padStart(2, '0')}`, 1),
  )
  const { stats } = leaderboardStatsForRange(players, sessions, null)
  const visible = filterLowActivityPlayers(stats).visibleStats
  expect(visible.map(stat => stat.player.id)).toEqual(['a'])
  expect(sortLeaderboard(stats, 'total_yuan', 'asc').map(s => s.player.id)).toEqual(['b', 'c', 'a'])
  expect(stats.map(s => s.player.id)).toEqual(['a', 'b', 'c'])
  expect(buildChartData(sessions, stats, 'cny').at(-1)).toMatchObject({ b: 0, c: 0 })
})
it('keeps players without sessions only in the all-time range', () => {
  expect(leaderboardStatsForRange(players, [], null).stats).toHaveLength(3)
  expect(leaderboardStatsForRange(players, [], { start: '2026-01-01', end: '2026-01-31' }).stats).toEqual([])
})

it('orders same-day cumulative points by end time with missing times first and stable ID ties', () => {
  const sessions = [
    { ...session('late-b', '2026-01-01', 8, 1), ended_at: '2026-01-01T20:00:00Z' },
    { ...session('early', '2026-01-01', -4, 1), ended_at: '2026-01-01T10:00:00Z' },
    { ...session('late-a', '2026-01-01', 2, 1), ended_at: '2026-01-01T20:00:00Z' },
    session('import', '2026-01-01', 1, 1),
  ]
  const { stats } = leaderboardStatsForRange(players, sessions, null)
  const points = buildChartData(sessions, stats, 'cny')
  expect(points.map(point => point.a)).toEqual([1, -3, -1, 7])
  expect(points.map(point => point.session_id)).toEqual(['import', 'early', 'late-a', 'late-b'])
  expect(stats.find(stat => stat.player.id === 'a')?.total_yuan).toBe(7)
  expect(sessions.map(row => row.id)).toEqual(['late-b', 'early', 'late-a', 'import'])
})
