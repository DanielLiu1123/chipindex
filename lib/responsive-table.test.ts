import { expect, it } from 'vitest'
import { allocateTableColumns } from './responsive-table'

const columns = [
  { key: 'date', minWidth: 104 }, { key: 'cny', minWidth: 108 },
  { key: 'chips', minWidth: 108 }, { key: 'cumulative_cny', minWidth: 108 },
  { key: 'cumulative', minWidth: 108 },
]
it('hides history columns in priority order and restores them when space returns', () => {
  const order = ['cumulative', 'chips', 'cumulative_cny']
  for (const [width, count] of [[720, 5], [450, 4], [350, 3], [280, 2], [720, 5]]) {
    const result = allocateTableColumns(width, columns, order)
    expect(result.visible).toHaveLength(count)
    expect(order.filter(key => !result.visible.includes(key))).toEqual(order.slice(0, 5 - count))
    expect(Object.values(result.widths).reduce((a, b) => a + b, 0)).toBeCloseTo(width)
  }
})
it('reserves measured amounts and wraps a long player name at the two-column floor', () => {
  const result = allocateTableColumns(300, [
    { key: 'player', minWidth: 120, wrap: true }, { key: 'cny', minWidth: 104 }, { key: 'chips', minWidth: 96 },
  ], ['chips'], { player: 600, cny: 140 })
  expect(result).toEqual({ visible: ['player', 'cny'], widths: { player: 160, cny: 140 } })
})
it('keeps operation columns fixed and available', () => {
  const result = allocateTableColumns(280, [
    { key: 'date', minWidth: 120 }, { key: 'description', minWidth: 140, wrap: true },
    { key: 'players', minWidth: 72 }, { key: 'pog', minWidth: 90, wrap: true },
    { key: 'rate', minWidth: 60 }, { key: 'actions', minWidth: 52, fixed: true },
  ], ['description', 'rate', 'pog'])
  expect(result.visible).toEqual(['date', 'players', 'actions'])
  expect(result.widths.actions).toBe(52)
})
