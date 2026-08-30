import { describe, expect, it } from 'vitest'
import { buildPaymentPlan } from './payment-plan'

describe('buildPaymentPlan', () => {
  it('pays a single winner from a single loser', () => {
    expect(buildPaymentPlan([
      { player_id: 'alice', net_chips: -2000, order: 0 },
      { player_id: 'bob', net_chips: 2000, order: 1 },
    ], 40)).toEqual({
      balanced: true,
      exact: true,
      rounding_adjustment_cents: 0,
      transfers: [{ from_player_id: 'alice', to_player_id: 'bob', amount_cents: 5000 }],
    })
  })

  it('balances fractional cents deterministically', () => {
    expect(buildPaymentPlan([
      { player_id: 'alice', net_chips: -1, order: 0 },
      { player_id: 'bob', net_chips: -1, order: 1 },
      { player_id: 'carol', net_chips: 2, order: 2 },
    ], 3)).toEqual({
      balanced: true,
      exact: true,
      rounding_adjustment_cents: 1,
      transfers: [
        { from_player_id: 'alice', to_player_id: 'carol', amount_cents: 34 },
        { from_player_id: 'bob', to_player_id: 'carol', amount_cents: 33 },
      ],
    })
  })

  it('finds fewer transfers than largest-balance greedy for small sessions', () => {
    const plan = buildPaymentPlan([
      { player_id: 'd8', net_chips: -8, order: 0 },
      { player_id: 'd7', net_chips: -7, order: 1 },
      { player_id: 'd6', net_chips: -6, order: 2 },
      { player_id: 'd5', net_chips: -5, order: 3 },
      { player_id: 'c9', net_chips: 9, order: 4 },
      { player_id: 'c8', net_chips: 8, order: 5 },
      { player_id: 'c5', net_chips: 5, order: 6 },
      { player_id: 'c4', net_chips: 4, order: 7 },
    ], 100)

    expect(plan.exact).toBe(true)
    expect(plan.transfers).toHaveLength(5)
  })

  it('falls back to a balanced deterministic plan above twelve non-zero balances', () => {
    const plan = buildPaymentPlan([
      ...Array.from({ length: 7 }, (_, order) => ({ player_id: `d${order}`, net_chips: -6, order })),
      ...Array.from({ length: 6 }, (_, index) => ({ player_id: `c${index}`, net_chips: 7, order: index + 7 })),
    ], 100)

    expect(plan.exact).toBe(false)
    expect(plan.balanced).toBe(true)
    expect(plan.transfers.reduce((sum, transfer) => sum + transfer.amount_cents, 0)).toBe(42)
    expect(buildPaymentPlan([
      ...Array.from({ length: 7 }, (_, order) => ({ player_id: `d${order}`, net_chips: -6, order })),
      ...Array.from({ length: 6 }, (_, index) => ({ player_id: `c${index}`, net_chips: 7, order: index + 7 })),
    ], 100).transfers).toEqual(plan.transfers)
  })

  it('handles the twelve-player exact-search boundary without factorial work', () => {
    const plan = buildPaymentPlan([
      { player_id: 'debtor', net_chips: -66, order: 0 },
      ...Array.from({ length: 11 }, (_, index) => ({
        player_id: `creditor-${index}`,
        net_chips: index + 1,
        order: index + 1,
      })),
    ], 100)

    expect(plan.exact).toBe(true)
    expect(plan.transfers).toHaveLength(11)
  })
})
