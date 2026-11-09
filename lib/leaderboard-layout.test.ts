import { expect, it } from 'vitest'
import { allocateLeaderboardColumns, leaderboardMinWidths } from './leaderboard-layout'

it('shares space equally when names and data fit', () => {
  const result = allocateLeaderboardColumns(748)
  expect(result.visible).toHaveLength(6)
  expect(Object.values(result.widths)).toEqual([120, 120, 120, 120, 120, 120])
})
it('gives long names priority and shares remaining space', () => {
  const result = allocateLeaderboardColumns(610, { player: 190 })
  expect(result.widths.player).toBe(190)
  expect(result.visible).not.toContain('total_chips')
  expect(Object.values(result.widths).filter(width => width !== 190)).toEqual([104, 96, 96, 96])
})
it('hides columns in order and fills available width without violating numeric minimums', () => {
  const order = ['total_chips', 'sessions_played', 'win_rate', 'pog_count'] as const
  for (const nameWidth of [72, 140, 250, 1000]) {
    for (let width = 280; width <= 1000; width += 10) {
      const result = allocateLeaderboardColumns(width, { player: nameWidth })
      const hidden = order.filter(key => !result.visible.includes(key))
      expect(hidden).toEqual(order.slice(0, hidden.length))
      expect(result.visible).toContain('player')
      expect(result.visible).toContain('total_yuan')
      expect(Object.values(result.widths).reduce((sum, value) => sum + value, 28)).toBeCloseTo(width)
      for (const key of result.visible) if (key !== 'player') expect(result.widths[key]).toBeGreaterThanOrEqual(leaderboardMinWidths[key])
    }
  }
})
it('wraps extreme names at the three-column floor and reserves measured amount width', () => {
  expect(allocateLeaderboardColumns(320, { player: 1000, total_yuan: 140 })).toEqual({
    rank: 28, visible: ['player', 'total_yuan'], widths: { player: 152, total_yuan: 140 },
  })
})
