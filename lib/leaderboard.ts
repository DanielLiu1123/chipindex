import type { LeaderboardChartPoint } from './chart'
import {
  computeLeaderboardStats,
  filterLowActivityPlayers,
  type PlayerStats,
} from './stats'
import {
  filterLeaderboardSessions,
  type LeaderboardRange,
} from './leaderboard-range'
import type { LeaderboardSessionRow, Player } from './domain-types'
import { compareSettledSessionsOldestFirst } from './session-order'

export type LeaderboardSortKey =
  'total_yuan' | 'total_chips' | 'sessions_played' | 'win_rate' | 'pog_count'

export function buildChartData(
  sessions: LeaderboardSessionRow[],
  stats: PlayerStats[],
  mode: 'chips' | 'cny',
): LeaderboardChartPoint[] {
  const sorted = [...sessions].sort(compareSettledSessionsOldestFirst)
  const playerIds = stats.map((s) => s.player.id)

  const cumulative = new Map<string, number>()
  playerIds.forEach((pid) => cumulative.set(pid, 0))

  return sorted.map((session) => {
    const row: LeaderboardChartPoint = {
      session_id: session.id,
      date: session.date,
    }
    playerIds.forEach((pid) => {
      const entry = session.session_entries.find((e) => e.player_id === pid)
      if (entry) {
        const delta =
          mode === 'cny' ? entry.chips / session.exchange_rate : entry.chips
        cumulative.set(pid, (cumulative.get(pid) ?? 0) + delta)
      }
      row[pid] =
        mode === 'cny'
          ? Math.round((cumulative.get(pid) ?? 0) * 100) / 100
          : (cumulative.get(pid) ?? 0)
    })
    return row
  })
}

export function sortLeaderboard(stats: PlayerStats[], key: LeaderboardSortKey, direction: 'asc' | 'desc') {
  const dir = direction === 'desc' ? -1 : 1
  return [...stats].sort((a, b) =>
    dir * (a[key] - b[key]) || a.player.id.localeCompare(b.player.id),
  )
}

export function leaderboardStatsForRange(players: Player[], sessions: LeaderboardSessionRow[], range: LeaderboardRange | null) {
  const filtered = filterLeaderboardSessions(sessions, range)
  const stats = computeLeaderboardStats(players, filtered)
  return {
    sessions: filtered,
    stats: range ? stats.filter(stat => stat.sessions_played > 0) : stats,
  }
}
