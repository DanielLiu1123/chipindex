import type { Player } from '@/types'
import type { LeaderboardSessionRow, PlayerDetail } from '@/lib/queries'
import { toCny } from '@/lib/settlement'

// All derived statistics live here: POG / wins / cumulative totals.
// queries.ts is responsible for reading; this file is responsible for computing.

export interface PlayerStats {
  player: Player
  total_chips: number
  total_yuan: number
  sessions_played: number
  wins: number
  win_rate: number
  pog_count: number
}

// Highest chips in a session (the basis for player-of-the-game). Returns null
// for an empty session, so nobody is counted as POG.
function topChips(entries: { chips: number }[]): number | null {
  if (entries.length === 0) return null
  return entries.reduce((m, e) => (e.chips > m ? e.chips : m), entries[0].chips)
}

// Home leaderboard: sorted by CNY → chips → name
export function computeLeaderboardStats(players: Player[], sessions: LeaderboardSessionRow[]): PlayerStats[] {
  const sessionTop = new Map<string, number | null>()
  for (const s of sessions) sessionTop.set(s.id, topChips(s.session_entries))

  return players
    .map(player => {
      let total_chips = 0
      let total_yuan = 0
      let sessions_played = 0
      let wins = 0
      let pog_count = 0

      for (const s of sessions) {
        const entry = s.session_entries.find(e => e.player_id === player.id)
        if (!entry) continue
        sessions_played++
        total_chips += entry.chips
        if (entry.chips > 0) wins++
        total_yuan += entry.chips / s.exchange_rate
        if (entry.chips === sessionTop.get(s.id)) pog_count++
      }

      return {
        player,
        total_chips,
        total_yuan: Math.round(total_yuan * 100) / 100,
        sessions_played,
        wins,
        win_rate: sessions_played > 0 ? wins / sessions_played : 0,
        pog_count,
      }
    })
    .sort((a, b) => {
      if (b.total_yuan !== a.total_yuan) return b.total_yuan - a.total_yuan
      if (b.total_chips !== a.total_chips) return b.total_chips - a.total_chips
      return a.player.name.localeCompare(b.player.name)
    })
}

// Player detail: date-sorted cumulative curve + summary
export interface HistoryPoint {
  date: string
  session_id: string
  chips: number
  cumulative: number
  cny: number
  cumulative_cny: number
  description: string | null
}

export interface PlayerHistory {
  history: HistoryPoint[]
  totalCny: number
  totalChips: number
  wins: number
  pogCount: number
}

export function computePlayerHistory(detail: PlayerDetail): PlayerHistory {
  const sorted = [...detail.entries].sort((a, b) => a.sessions.date.localeCompare(b.sessions.date))

  let cumulative = 0
  let cumulativeCny = 0
  const history: HistoryPoint[] = sorted.map(e => {
    cumulative += e.chips
    const cny = toCny(e.chips, e.sessions.exchange_rate)
    cumulativeCny += cny
    return {
      date: e.sessions.date,
      session_id: e.session_id,
      chips: e.chips,
      cumulative,
      cny,
      cumulative_cny: cumulativeCny,
      description: e.sessions.description,
    }
  })

  return {
    history,
    totalCny: history.length > 0 ? history[history.length - 1].cumulative_cny : 0,
    totalChips: history.length > 0 ? history[history.length - 1].cumulative : 0,
    wins: sorted.filter(e => e.chips > 0).length,
    pogCount: sorted.filter(e => e.chips === topChips(e.sessions.session_entries)).length,
  }
}
