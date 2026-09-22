import { describe, expect, test } from 'vitest'
import { sortTooltipItems } from './chart'

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
