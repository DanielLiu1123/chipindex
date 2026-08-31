import { describe, expect, it } from 'vitest'
import { buildPaymentPlan } from './payment-plan'

describe('buildPaymentPlan', () => {
  it('pays a single winner from a single loser', () => {
    expect(buildPaymentPlan([
      { playerId: 'alice', netChips: -2000 },
      { playerId: 'bob', netChips: 2000 },
    ], 40)).toEqual({
      roundingAdjustmentCents: 0,
      transfers: [{ fromPlayerId: 'alice', toPlayerId: 'bob', amountCents: 5000 }],
    })
  })

  it('balances fractional cents deterministically', () => {
    expect(buildPaymentPlan([
      { playerId: 'alice', netChips: -1 },
      { playerId: 'bob', netChips: -1 },
      { playerId: 'carol', netChips: 2 },
    ], 3)).toEqual({
      roundingAdjustmentCents: 1,
      transfers: [
        { fromPlayerId: 'alice', toPlayerId: 'carol', amountCents: 34 },
        { fromPlayerId: 'bob', toPlayerId: 'carol', amountCents: 33 },
      ],
    })
  })

  it('finds fewer transfers than largest-balance greedy for small sessions', () => {
    const plan = buildPaymentPlan([
      { playerId: 'd8', netChips: -8 },
      { playerId: 'd7', netChips: -7 },
      { playerId: 'd6', netChips: -6 },
      { playerId: 'd5', netChips: -5 },
      { playerId: 'c9', netChips: 9 },
      { playerId: 'c8', netChips: 8 },
      { playerId: 'c5', netChips: 5 },
      { playerId: 'c4', netChips: 4 },
    ], 100)

    expect(plan.transfers).toHaveLength(5)
  })

  it('falls back to a balanced deterministic plan above twelve non-zero balances', () => {
    const plan = buildPaymentPlan([
      ...Array.from({ length: 7 }, (_, index) => ({ playerId: `d${index}`, netChips: -6 })),
      ...Array.from({ length: 6 }, (_, index) => ({ playerId: `c${index}`, netChips: 7 })),
    ], 100)

    expect(plan.transfers.reduce((sum, transfer) => sum + transfer.amountCents, 0)).toBe(42)
    expect(buildPaymentPlan([
      ...Array.from({ length: 7 }, (_, index) => ({ playerId: `d${index}`, netChips: -6 })),
      ...Array.from({ length: 6 }, (_, index) => ({ playerId: `c${index}`, netChips: 7 })),
    ], 100).transfers).toEqual(plan.transfers)
  })

  it('handles the twelve-player exact-search boundary without factorial work', () => {
    const plan = buildPaymentPlan([
      { playerId: 'debtor', netChips: -66 },
      ...Array.from({ length: 11 }, (_, index) => ({
        playerId: `creditor-${index}`,
        netChips: index + 1,
      })),
    ], 100)

    expect(plan.transfers).toHaveLength(11)
  })

  it('rejects an unbalanced input instead of exposing balance metadata', () => {
    expect(() => buildPaymentPlan([
      { playerId: 'alice', netChips: -100 },
      { playerId: 'bob', netChips: 99 },
    ], 40)).toThrow('Payment balances must sum to zero')
  })
})
