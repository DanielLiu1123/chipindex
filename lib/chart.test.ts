import { describe, expect, test } from 'vitest'
import { prepareSortedTooltipProps, sortTooltipItems } from './chart'

describe('sortTooltipItems', () => {
  test('sorts tooltip items by value descending and player id ascending without mutating input', () => {
    const payload = [
      { dataKey: 'player-z', name: 'Zulu', value: -100 },
      { dataKey: 'player-b', name: 'Alpha', value: 250 },
      { dataKey: 'player-a', name: 'Beta', value: 250 },
      { dataKey: 'player-g', name: 'Gamma', value: 0 },
    ]

    const sorted = sortTooltipItems(payload)

    expect(sorted.map(item => item.dataKey)).toEqual(['player-a', 'player-b', 'player-g', 'player-z'])
    expect(payload.map(item => item.name)).toEqual(['Zulu', 'Alpha', 'Beta', 'Gamma'])
  })
})

describe('prepareSortedTooltipProps', () => {
  test('returns sorted payload and disables the default item sorter', () => {
    const payload = [
      { dataKey: 'player-z', name: 'Zulu', value: -100, graphicalItemId: 'zulu' },
      { dataKey: 'player-b', name: 'Alpha', value: 250, graphicalItemId: 'alpha' },
      { dataKey: 'player-a', name: 'Beta', value: 250, graphicalItemId: 'beta' },
      { dataKey: 'player-g', name: 'Gamma', value: 0, graphicalItemId: 'gamma' },
    ]

    const result = prepareSortedTooltipProps({ payload, itemSorter: 'name' })

    expect(result.payload.map(item => item.dataKey)).toEqual(['player-a', 'player-b', 'player-g', 'player-z'])
    expect(result.itemSorter).toBeUndefined()
  })
})
