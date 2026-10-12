// Settled lists show newest first; charts use the exact reverse order.
// The ID tie-breaker keeps equal end times and pagination deterministic.
interface SettledSession {
  id: string
  date: string
  ended_at: string | null
}

export function compareSettledSessionsNewestFirst(a: SettledSession, b: SettledSession): number {
  const dateOrder = b.date.localeCompare(a.date)
  if (dateOrder !== 0) return dateOrder

  if (a.ended_at !== b.ended_at) {
    if (a.ended_at === null) return 1
    if (b.ended_at === null) return -1
    const endOrder = Date.parse(b.ended_at) - Date.parse(a.ended_at)
    if (endOrder !== 0) return endOrder
  }
  return b.id.localeCompare(a.id)
}

export function compareSettledSessionsOldestFirst(a: SettledSession, b: SettledSession): number {
  return compareSettledSessionsNewestFirst(b, a)
}
