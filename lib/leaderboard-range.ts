import { localDate } from './browser-time'
import type { LeaderboardSessionRow } from './domain-types'

export type LeaderboardPeriod = 'all' | 'month' | 'last-month' | 'year' | 'custom'
export type LeaderboardFilter =
  | { period: 'all' }
  | { period: Exclude<LeaderboardPeriod, 'all'>; range: LeaderboardRange }
export interface LeaderboardRange { start: string; end: string }

export function presetLeaderboardRange(period: Exclude<LeaderboardPeriod, 'custom' | 'all'>, now = new Date()): LeaderboardRange {
  const year = now.getFullYear()
  const month = now.getMonth()
  switch (period) {
    case 'month': return { start: localDate(new Date(year, month, 1)), end: localDate(new Date(year, month + 1, 0)) }
    case 'last-month': return { start: localDate(new Date(year, month - 1, 1)), end: localDate(new Date(year, month, 0)) }
    case 'year': return { start: `${year}-01-01`, end: `${year}-12-31` }
  }
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T12:00:00`)
  return Number.isFinite(parsed.getTime()) && localDate(parsed) === value
}

export function leaderboardRangeError(range: LeaderboardRange): string | null {
  if (!isCalendarDate(range.start) || !isCalendarDate(range.end)) return 'Choose a valid start and end date.'
  if (range.start > range.end) return 'Start date must be on or before end date.'
  return null
}

export function filterLeaderboardSessions(sessions: LeaderboardSessionRow[], range: LeaderboardRange | null): LeaderboardSessionRow[] {
  if (!range) return sessions
  return sessions.filter(session => session.date >= range.start && session.date <= range.end)
}
