import { describe, expect, test } from 'vitest'
import { prepareSortedTooltipProps, sortTooltipItems } from './chart'

describe('sortTooltipItems', () => {
  test('sorts tooltip items by value descending and name ascending without mutating input', () => {
    const payload = [
      { name: 'Zulu', value: -100 },
      { name: 'Beta', value: 250 },
      { name: 'Alpha', value: 250 },
      { name: 'Gamma', value: 0 },
    ]

    const sorted = sortTooltipItems(payload)

    expect(sorted.map(item => item.name)).toEqual(['Alpha', 'Beta', 'Gamma', 'Zulu'])
    expect(payload.map(item => item.name)).toEqual(['Zulu', 'Beta', 'Alpha', 'Gamma'])
  })
})

describe('prepareSortedTooltipProps', () => {
  test('returns sorted payload and disables the default item sorter', () => {
    const payload = [
      { name: 'Zulu', value: -100, graphicalItemId: 'zulu' },
      { name: 'Beta', value: 250, graphicalItemId: 'beta' },
      { name: 'Alpha', value: 250, graphicalItemId: 'alpha' },
      { name: 'Gamma', value: 0, graphicalItemId: 'gamma' },
    ]

    const result = prepareSortedTooltipProps({ payload, itemSorter: 'name' })

    expect(result.payload.map(item => item.name)).toEqual(['Alpha', 'Beta', 'Gamma', 'Zulu'])
    expect(result.itemSorter).toBeUndefined()
  })
})
