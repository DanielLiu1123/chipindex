import { leaderboardRangeError, presetLeaderboardRange, type LeaderboardFilter } from './leaderboard-range'

export interface LeaderboardFilters {
  filter: LeaderboardFilter
  hideLowActivity: boolean
}

export function readLeaderboardFilters(query: Pick<URLSearchParams, 'get'>, now = new Date()): LeaderboardFilters {
  const period = query.get('period')
  let filter: LeaderboardFilter = { period: 'all' }
  if (period === 'month' || period === 'last-month' || period === 'year') {
    filter = { period, range: presetLeaderboardRange(period, now) }
  } else if (period === 'custom') {
    const range = { start: query.get('start') ?? '', end: query.get('end') ?? '' }
    if (!leaderboardRangeError(range)) filter = { period, range }
  }
  return { filter, hideLowActivity: query.get('active') !== '0' }
}

export function writeLeaderboardFilters(query: URLSearchParams, { filter, hideLowActivity }: LeaderboardFilters): void {
  for (const key of ['period', 'start', 'end', 'active']) query.delete(key)
  if (filter.period !== 'all') query.set('period', filter.period)
  if (filter.period === 'custom') {
    query.set('start', filter.range.start)
    query.set('end', filter.range.end)
  }
  if (!hideLowActivity) query.set('active', '0')
}
