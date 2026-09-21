import { describe, expect, it } from 'vitest'
import { leaderboardRangeError, presetLeaderboardRange } from './leaderboard-range'

describe('leaderboard calendar ranges', () => {
  it('handles local months, year rollover, and leap years', () => {
    const now = new Date(2026, 0, 1, 0, 30)
    expect(presetLeaderboardRange('month', now)).toEqual({ start: '2026-01-01', end: '2026-01-31' })
    expect(presetLeaderboardRange('last-month', now)).toEqual({ start: '2025-12-01', end: '2025-12-31' })
    expect(presetLeaderboardRange('year', now)).toEqual({ start: '2026-01-01', end: '2026-12-31' })
    expect(presetLeaderboardRange('last-month', new Date(2024, 2, 15))).toEqual({ start: '2024-02-01', end: '2024-02-29' })
    expect(presetLeaderboardRange('all', now)).toEqual({ start: '', end: '' })
  })

  it('accepts single-day ranges and rejects incomplete, impossible or reversed dates', () => {
    expect(leaderboardRangeError({ start: '2024-02-29', end: '2024-02-29' })).toBeNull()
    for (const range of [
      { start: '', end: '2026-01-01' },
      { start: '2026-02-29', end: '2026-03-01' },
      { start: '2026-02-01', end: '2026-01-31' },
    ]) expect(leaderboardRangeError(range)).not.toBeNull()
  })
})
