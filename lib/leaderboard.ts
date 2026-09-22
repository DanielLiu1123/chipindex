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

export type LeaderboardSortKey =
  'total_yuan' | 'total_chips' | 'sessions_played' | 'win_rate' | 'pog_count'

function buildChartData(
  sessions: LeaderboardSessionRow[],
  stats: PlayerStats[],
  mode: 'chips' | 'cny',
): { date: string; [player: string]: string | number }[] {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  const playerIds = stats.map((s) => s.player.id)

  const cumulative = new Map<string, number>()
  playerIds.forEach((pid) => cumulative.set(pid, 0))

  return sorted.map((session) => {
    const row: { date: string; [k: string]: string | number } = {
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

// Owns the ordering of range selection, activity filtering and cumulative data.
// Display sorting never changes the series order or its colors.
export function buildLeaderboard(
  players: Player[],
  sessions: LeaderboardSessionRow[],
  options: {
    range: LeaderboardRange | null
    hideLowActivity: boolean
    chartMode: 'chips' | 'cny'
    sortKey: LeaderboardSortKey
    sortDir: 'asc' | 'desc'
  },
) {
  const filtered = filterLeaderboardSessions(sessions, options.range)
  const computed = computeLeaderboardStats(players, filtered)
  const stats = options.range
    ? computed.filter((stat) => stat.sessions_played > 0)
    : computed
  const activityFilter = filterLowActivityPlayers(stats)
  const displayed = options.hideLowActivity
    ? activityFilter.visibleStats
    : stats
  const dir = options.sortDir === 'desc' ? -1 : 1
  return {
    sessionCount: filtered.length,
    playerCount: stats.length,
    activityFilter,
    emptyRange: options.range !== null && filtered.length === 0,
    sortedStats: [...displayed].sort(
      (a, b) =>
        dir * (a[options.sortKey] - b[options.sortKey]) ||
        a.player.id.localeCompare(b.player.id),
    ),
    chartPlayers: displayed.map((stat) => ({
      id: stat.player.id,
      name: stat.player.name,
    })),
    chartData: buildChartData(filtered, displayed, options.chartMode),
  }
}
