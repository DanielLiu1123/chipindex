import { describe, it, expect } from 'vitest'
import { computeLeaderboardStats, computePlayerHistory } from './stats'
import type { LeaderboardSessionRow, PlayerDetail } from './queries'
import type { Player } from '@/types'

const players: Player[] = [
  { id: 'alice', name: 'Alice', created_at: '2026-01-01' },
  { id: 'bob', name: 'Bob', created_at: '2026-01-01' },
  { id: 'carol', name: 'Carol', created_at: '2026-01-01' },
]

const sessions: LeaderboardSessionRow[] = [
  {
    id: 's1',
    date: '2026-01-10',
    exchange_rate: 40,
    session_entries: [
      { player_id: 'alice', chips: 4000 },
      { player_id: 'bob', chips: -4000 },
    ],
  },
  {
    id: 's2',
    date: '2026-01-17',
    exchange_rate: 40,
    session_entries: [
      { player_id: 'alice', chips: -2000 },
      { player_id: 'bob', chips: 2000 },
    ],
  },
]

describe('computeLeaderboardStats', () => {
  const stats = computeLeaderboardStats(players, sessions)

  it('accumulates chips and CNY per player', () => {
    const alice = stats.find(s => s.player.id === 'alice')!
    expect(alice.total_chips).toBe(2000)
    expect(alice.total_yuan).toBe(50)
    expect(alice.sessions_played).toBe(2)
  })

  it('counts wins and POG per session', () => {
    const alice = stats.find(s => s.player.id === 'alice')!
    const bob = stats.find(s => s.player.id === 'bob')!
    expect(alice.wins).toBe(1)
    expect(alice.pog_count).toBe(1)
    expect(bob.wins).toBe(1)
    expect(bob.pog_count).toBe(1)
  })

  it('leaves players with no sessions at zero', () => {
    const carol = stats.find(s => s.player.id === 'carol')!
    expect(carol.sessions_played).toBe(0)
    expect(carol.win_rate).toBe(0)
  })

  it('sorts by CNY descending', () => {
    expect(stats.map(s => s.player.id)).toEqual(['alice', 'carol', 'bob'])
  })
})

describe('computePlayerHistory', () => {
  const detail: PlayerDetail = {
    id: 'alice',
    name: 'Alice',
    entries: [
      {
        session_id: 's2',
        chips: -2000,
        sessions: {
          id: 's2',
          date: '2026-01-17',
          description: null,
          exchange_rate: 40,
          session_entries: sessions[1].session_entries,
        },
      },
      {
        session_id: 's1',
        chips: 4000,
        sessions: {
          id: 's1',
          date: '2026-01-10',
          description: 'first game',
          exchange_rate: 40,
          session_entries: sessions[0].session_entries,
        },
      },
    ],
  }

  const history = computePlayerHistory(detail)

  it('orders points by date and accumulates totals', () => {
    expect(history.history.map(h => h.session_id)).toEqual(['s1', 's2'])
    expect(history.history[1].cumulative).toBe(2000)
    expect(history.history[1].cumulative_cny).toBe(50)
  })

  it('reports summary totals from the last point', () => {
    expect(history.totalChips).toBe(2000)
    expect(history.totalCny).toBe(50)
    expect(history.wins).toBe(1)
    expect(history.pogCount).toBe(1)
  })
})
