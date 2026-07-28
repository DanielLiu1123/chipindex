import type { Player } from '@/types'
import type { LeaderboardSessionRow, PlayerDetail, PlayerHistoryEntry } from '@/lib/queries'
import { netChips, toCny } from '@/lib/settlement'

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

export interface CandlePoint {
  open: number
  high: number
  low: number
  close: number
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
  buy_in_count: number
  total_buyin: number
  final_chips: number | null
  chips_candle: CandlePoint
  cny_candle: CandlePoint
}

export interface PlayerHistory {
  history: HistoryPoint[]
  totalCny: number
  totalChips: number
  wins: number
  pogCount: number
}

function timestamp(value: string | null): number | null {
  if (value === null) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function compareHistoryEntries(a: PlayerHistoryEntry, b: PlayerHistoryEntry): number {
  const dateOrder = a.sessions.date.localeCompare(b.sessions.date)
  if (dateOrder !== 0) return dateOrder

  const aTimestamp = timestamp(a.sessions.started_at)
  const bTimestamp = timestamp(b.sessions.started_at)
  if (aTimestamp !== null && bTimestamp === null) return -1
  if (aTimestamp === null && bTimestamp !== null) return 1
  if (aTimestamp !== null && bTimestamp !== null && aTimestamp !== bTimestamp) {
    return aTimestamp - bTimestamp
  }

  return a.session_id.localeCompare(b.session_id)
}

function createCandle(open: number, net: number, buyIn: number): CandlePoint {
  const close = open + net
  return {
    open,
    high: Math.max(open, close),
    low: open - buyIn,
    close,
  }
}

function topSettledChips(entries: { final_chips: number | null; total_buyin: number }[]): number | null {
  if (entries.length === 0) return null
  return entries.reduce((top, entry) => {
    const chips = netChips(entry.final_chips, entry.total_buyin)
    return chips > top ? chips : top
  }, netChips(entries[0].final_chips, entries[0].total_buyin))
}

export function computePlayerHistory(detail: PlayerDetail): PlayerHistory {
  const sorted = [...detail.entries].sort(compareHistoryEntries)

  let cumulative = 0
  let cumulativeCny = 0
  let wins = 0
  let pogCount = 0
  const history: HistoryPoint[] = sorted.map(e => {
    const effectiveNet = netChips(e.final_chips, e.total_buyin)
    const chipsCandle = createCandle(cumulative, effectiveNet, e.total_buyin)
    const cny = toCny(effectiveNet, e.sessions.exchange_rate)
    const buyInCny = toCny(e.total_buyin, e.sessions.exchange_rate)
    const cnyCandle = createCandle(cumulativeCny, cny, buyInCny)
    cumulative = chipsCandle.close
    cumulativeCny = cnyCandle.close
    if (effectiveNet > 0) wins++
    if (effectiveNet === topSettledChips(e.sessions.session_entries)) pogCount++

    return {
      date: e.sessions.date,
      session_id: e.session_id,
      chips: effectiveNet,
      cumulative,
      cny,
      cumulative_cny: cumulativeCny,
      description: e.sessions.description,
      buy_in_count: e.buy_in_count,
      total_buyin: e.total_buyin,
      final_chips: e.final_chips,
      chips_candle: chipsCandle,
      cny_candle: cnyCandle,
    }
  })

  return {
    history,
    totalCny: history.length > 0 ? history[history.length - 1].cumulative_cny : 0,
    totalChips: history.length > 0 ? history[history.length - 1].cumulative : 0,
    wins,
    pogCount,
  }
}
