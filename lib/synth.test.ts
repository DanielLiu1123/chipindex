import { describe, it, expect } from 'vitest'
import { synthFromNet, BUY_IN_UNIT } from './synth'

describe('synthFromNet', () => {
  const nets = [0, 1, -1, 2000, -2000, 3500, -3500, -4001, 100000]

  it.each(nets)('preserves the net result exactly for net=%i', net => {
    const { amount, final_chips } = synthFromNet(net)
    expect(final_chips - amount).toBe(net)
  })

  it.each(nets)('amount is a positive multiple of BUY_IN_UNIT for net=%i', net => {
    const { amount } = synthFromNet(net)
    expect(amount).toBeGreaterThan(0)
    expect(amount % BUY_IN_UNIT).toBe(0)
  })

  it.each(nets)('final_chips is never negative for net=%i', net => {
    expect(synthFromNet(net).final_chips).toBeGreaterThanOrEqual(0)
  })

  it('uses a single unit when the net result fits', () => {
    expect(synthFromNet(0)).toEqual({ amount: BUY_IN_UNIT, final_chips: BUY_IN_UNIT })
    expect(synthFromNet(500)).toEqual({ amount: BUY_IN_UNIT, final_chips: BUY_IN_UNIT + 500 })
  })

  it('scales the buy-in up to cover a loss beyond one unit', () => {
    expect(synthFromNet(-4001)).toEqual({ amount: 3 * BUY_IN_UNIT, final_chips: 3 * BUY_IN_UNIT - 4001 })
  })
})
