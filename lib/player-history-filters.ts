import { leaderboardRangeError, type LeaderboardFilter } from './leaderboard-range'
import type { PlayerHistoryEntry } from './domain-types'

export type PlayerAttendanceRule = 'include' | 'exclude'
export type PlayerAttendanceRules = Record<string, PlayerAttendanceRule>
export type PlayerHistoryQuery = Record<string, string | string[] | undefined>

export function readPlayerHistoryFilters(query: PlayerHistoryQuery, playerIds: string[]) {
  const period = query.period
  const range = { start: query.from, end: query.to }
  const date: LeaderboardFilter = (
    (period === 'month' || period === 'last-month' || period === 'year' || period === 'custom')
    && typeof range.start === 'string' && typeof range.end === 'string'
    && !leaderboardRangeError({ start: range.start, end: range.end })
  ) ? { period, range: { start: range.start, end: range.end } } : { period: 'all' }

  const included = new Set(query.include === undefined ? [] : [query.include].flat())
  const excluded = new Set(query.exclude === undefined ? [] : [query.exclude].flat())
  const attendance: PlayerAttendanceRules = {}
  for (const id of playerIds) {
    if (included.has(id)) attendance[id] = 'include'
    else if (excluded.has(id)) attendance[id] = 'exclude'
  }
  return { date, attendance }
}

export function playerHistoryFilterParams(date: LeaderboardFilter, attendance: PlayerAttendanceRules): [string, string][] {
  const params: [string, string][] = date.period === 'all' ? [] : [
    ['period', date.period], ['from', date.range.start], ['to', date.range.end],
  ]
  for (const id of Object.keys(attendance).sort()) params.push([attendance[id], id])
  return params
}

export function matchesPlayerAttendance(playerIds: string[], rules: [string, PlayerAttendanceRule][]) {
  return rules.every(([id, rule]) => playerIds.includes(id) === (rule === 'include'))
}

export function scopePlayerHistory(entries: PlayerHistoryEntry[], date: LeaderboardFilter) {
  if (date.period === 'all') return entries
  return entries.filter(({ sessions }) => sessions.date >= date.range.start && sessions.date <= date.range.end)
}
