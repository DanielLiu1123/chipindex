import { describe, it, expect } from 'vitest'
import { buyinSum, netChips, toCny, checkConservation } from './settlement'

describe('buyinSum', () => {
  it('returns 0 for no buy-ins', () => {
    expect(buyinSum([])).toBe(0)
  })

  it('sums all amounts', () => {
    expect(buyinSum([{ amount: 2000 }, { amount: 2000 }, { amount: 500 }])).toBe(4500)
  })
})

describe('netChips', () => {
  it('subtracts the buy-in total from the final count', () => {
    expect(netChips(5000, 4000)).toBe(1000)
    expect(netChips(1000, 4000)).toBe(-3000)
  })

  it('treats a missing final count as 0', () => {
    expect(netChips(null, 2000)).toBe(-2000)
  })
})

describe('toCny', () => {
  it('converts at the exchange rate and rounds to 2 decimals', () => {
    expect(toCny(4000, 40)).toBe(100)
    expect(toCny(-4000, 40)).toBe(-100)
    expect(toCny(50, 40)).toBe(1.25)
    expect(toCny(-50, 40)).toBe(-1.25)
  })
})

describe('checkConservation', () => {
  it('balances when chips on the table equal chips bought in', () => {
    expect(checkConservation(8000, 8000)).toEqual({
      balanced: true,
      diff: 0,
      total_buyin: 8000,
      total_final: 8000,
    })
  })

  it('reports surplus chips as a positive diff', () => {
    const result = checkConservation(8000, 8500)
    expect(result.balanced).toBe(false)
    expect(result.diff).toBe(500)
  })

  it('reports missing chips as a negative diff', () => {
    const result = checkConservation(8000, 7000)
    expect(result.balanced).toBe(false)
    expect(result.diff).toBe(-1000)
  })
})
