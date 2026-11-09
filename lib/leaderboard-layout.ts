export const LEADERBOARD_RANK_WIDTH = 28

export const leaderboardColumns = ['player', 'total_yuan', 'total_chips', 'sessions_played', 'win_rate', 'pog_count'] as const
export type LeaderboardColumn = typeof leaderboardColumns[number]
export const leaderboardMinWidths: Record<LeaderboardColumn, number> = {
  player: 72, total_yuan: 104, total_chips: 96, sessions_played: 80, win_rate: 64, pog_count: 56,
}
const hideOrder: LeaderboardColumn[] = ['total_chips', 'sessions_played', 'win_rate', 'pog_count']

// Widths include cell padding. The caller measures text using the rendered font.
export function allocateLeaderboardColumns(width: number, measured: Partial<Record<LeaderboardColumn, number>> = {}) {
  const rank = LEADERBOARD_RANK_WIDTH
  const minimum = { ...leaderboardMinWidths }
  for (const key of leaderboardColumns) minimum[key] = Math.max(minimum[key], measured[key] ?? 0)
  let visible: LeaderboardColumn[] = [...leaderboardColumns]
  for (const key of hideOrder) {
    if (rank + visible.reduce((sum, col) => sum + minimum[col], 0) <= width) break
    visible = visible.filter(col => col !== key)
  }
  // At the three-column floor, long names wrap instead of widening the table.
  minimum.player = Math.min(minimum.player, Math.max(0, width - rank - minimum.total_yuan))
  const widths: Partial<Record<LeaderboardColumn, number>> = {}
  let pending = [...visible]
  let remaining = width - rank
  while (pending.length) {
    const share = remaining / pending.length
    const constrained = pending.filter(col => minimum[col] > share)
    if (!constrained.length) {
      for (const col of pending) widths[col] = share
      break
    }
    for (const col of constrained) {
      widths[col] = minimum[col]
      remaining -= minimum[col]
    }
    pending = pending.filter(col => !constrained.includes(col))
  }
  return { rank, visible, widths }
}
