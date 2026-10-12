import { expect, it } from 'vitest'
import { compareSettledSessionsNewestFirst, compareSettledSessionsOldestFirst } from './session-order'

it('uses date, end-time instants, nulls last and descending IDs for settled lists', () => {
  const rows = [
    { id: 'null-a', date: '2026-01-01', ended_at: null },
    { id: 'early', date: '2026-01-01', ended_at: '2026-01-01T12:00:00+08:00' },
    { id: 'same-b', date: '2026-01-01', ended_at: '2026-01-01T05:00:00Z' },
    { id: 'same-a', date: '2026-01-01', ended_at: '2026-01-01T13:00:00+08:00' },
    { id: 'new-date', date: '2026-01-02', ended_at: null },
    { id: 'null-b', date: '2026-01-01', ended_at: null },
  ]
  const newest = [...rows].sort(compareSettledSessionsNewestFirst)
  expect(newest.map(row => row.id)).toEqual(['new-date', 'same-b', 'same-a', 'early', 'null-b', 'null-a'])
  expect([...rows].sort(compareSettledSessionsOldestFirst)).toEqual([...newest].reverse())
})
