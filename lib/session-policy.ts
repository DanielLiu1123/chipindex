import { ApiError } from './http'
import { checkConservation } from './settlement'

export function requireConservation(totalBuyin: number, totalFinal: number, force: boolean): number {
  const result = checkConservation(totalBuyin, totalFinal)
  if (!result.balanced && !force) {
    throw new ApiError(422, 'unbalanced', {
      diff: result.diff,
      total_buyin: result.total_buyin,
      total_final: result.total_final,
    })
  }
  return result.diff
}

export function requireNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) throw new ApiError(400, `${field} must be a non-negative integer`)
}

export function requirePositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value <= 0) throw new ApiError(400, `${field} must be a positive integer`)
}
