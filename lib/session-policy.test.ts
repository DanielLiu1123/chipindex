import { describe, expect, it } from 'vitest'
import { ApiError } from './http'
import { requireConservation, requireNonNegativeInteger, requirePositiveInteger } from './session-policy'

describe('session policy', () => {
  it('returns the conservation diff when balanced or explicitly forced', () => {
    expect(requireConservation(4_000, 4_000, false)).toBe(0)
    expect(requireConservation(4_000, 3_000, true)).toBe(-1_000)
  })

  it('preserves conservation details in the domain error', () => {
    expect(() => requireConservation(4_000, 3_000, false)).toThrowError(expect.objectContaining({
      status: 422,
      message: 'unbalanced',
      payload: { diff: -1_000, total_buyin: 4_000, total_final: 3_000 },
    }))
  })

  it('enforces integer chip amounts at the policy boundary', () => {
    expect(() => requireNonNegativeInteger(0, 'final_chips')).not.toThrow()
    expect(() => requirePositiveInteger(1, 'amount')).not.toThrow()
    expect(() => requireNonNegativeInteger(-1, 'final_chips')).toThrow(ApiError)
    expect(() => requirePositiveInteger(0, 'amount')).toThrow(ApiError)
  })
})
