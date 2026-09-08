import type { Player } from './domain-types'

// Called by the browser: imported dates mean local midnight, not Shanghai/UTC.
export function orderPlayersByRecentParticipation(players: Player[]): Player[] {
  const activityTime = (player: Player) => {
    const activity = player.recent_activity
    if (!activity) return -Infinity
    return Math.max(activity.latest_started_at ? Date.parse(activity.latest_started_at) : -Infinity,
      activity.latest_import_date ? Date.parse(`${activity.latest_import_date}T00:00:00`) : -Infinity)
  }
  if (!players.some(player => player.recent_activity)) return players
  return [...players].sort((a, b) => {
    const aTime = activityTime(a), bTime = activityTime(b)
    if (aTime === -Infinity && bTime !== -Infinity) return -1
    if (bTime === -Infinity && aTime !== -Infinity) return 1
    return (aTime === bTime ? 0 : bTime - aTime)
      || (b.recent_activity?.joined_at ?? b.created_at).localeCompare(a.recent_activity?.joined_at ?? a.created_at)
      || a.id.localeCompare(b.id)
  })
}
