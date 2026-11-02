import { expect, it } from 'vitest'
import { readLeaderboardFilters, updateLeaderboardFilterQuery } from './leaderboard-filter-query'

it('resolves presets at opening time rather than persisting their old ranges', () => {
  const query = new URLSearchParams('period=month&start=2026-11-01&end=2026-11-30')
  expect(readLeaderboardFilters(query, new Date(2026, 11, 5)).filter).toEqual({
    period: 'month', range: { start: '2026-12-01', end: '2026-12-31' },
  })
})

it.each([
  '', 'period=unknown', 'period=custom',
  'period=custom&start=2026-02-30&end=2026-03-01',
  'period=custom&start=2026-03-02&end=2026-03-01',
])('uses defaults for absent or invalid date parameters: %s', search => {
  expect(readLeaderboardFilters(new URLSearchParams(search))).toEqual({
    filter: { period: 'all' }, hideLowActivity: true,
  })
})

it('round-trips custom filters, preserves unrelated parameters and removes defaults', () => {
  const filters = { filter: { period: 'custom' as const, range: { start: '2026-01-01', end: '2026-02-01' } }, hideLowActivity: false }
  const query = updateLeaderboardFilterQuery('other=keep', filters)
  expect(readLeaderboardFilters(query)).toEqual(filters)
  expect(query.get('other')).toBe('keep')
  const reset = updateLeaderboardFilterQuery(query.toString(), { filter: { period: 'all' }, hideLowActivity: true })
  expect(reset.toString()).toBe('other=keep')
  expect(readLeaderboardFilters(query)).toEqual(filters)
})

it('updates each filter independently without rewriting the other parameters', () => {
  const activity = updateLeaderboardFilterQuery('other=keep&period=month', { hideLowActivity: false })
  expect(activity.toString()).toBe('other=keep&period=month&active=0')
  const date = updateLeaderboardFilterQuery(activity.toString(), { filter: { period: 'year', range: { start: '2026-01-01', end: '2026-12-31' } } })
  expect(date.get('period')).toBe('year')
  expect(date.get('active')).toBe('0')
  expect(date.get('start')).toBeNull()
  expect(date.get('end')).toBeNull()
  expect(date.get('other')).toBe('keep')
})
