// Settled lists show newest first; charts use the exact reverse order.
// A stable ID tie-breaker also keeps pagination deterministic.
export const SETTLED_SESSION_ORDER = ['date', 'ended_at', 'id'] as const

export interface SettledSessionOrderKey {
  id: string
  date: string
  ended_at: string | null
}

export function compareSettledSessionsNewestFirst(a: SettledSessionOrderKey, b: SettledSessionOrderKey): number {
  for (const column of SETTLED_SESSION_ORDER) {
    const left = a[column]
    const right = b[column]
    if (left === right) continue
    if (left === null) return 1
    if (right === null) return -1
    // Compare instants, so different timestamp offsets still order correctly.
    const difference = column === 'ended_at'
      ? Date.parse(right) - Date.parse(left)
      : right.localeCompare(left)
    if (difference !== 0) return difference
  }
  return 0
}

export function compareSettledSessionsOldestFirst(a: SettledSessionOrderKey, b: SettledSessionOrderKey): number {
  return compareSettledSessionsNewestFirst(b, a)
}
