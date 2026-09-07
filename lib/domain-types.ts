// Domain-owned models. Persistence and HTTP adapters depend on these types.
export interface Player {
  recent_activity?: { latest_started_at: string | null; latest_import_date: string | null; joined_at: string }
  id: string
  name: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}
export interface Group {
  id: string
  name: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}
export interface GroupPlayer {
  id: string
  group_id: string
  player_id: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}
export type SessionStatus = 'OPEN' | 'SETTLED'

export interface PlayerDetail {
  id: string
  name: string
  group_player: GroupPlayer | null
  entries: PlayerHistoryEntry[]
}

export interface PlayerHistoryEntry {
  session_id: string
  chips: number
  final_chips: number | null
  total_buyin: number
  buy_in_count: number
  sessions: PlayerHistorySession
}

export interface PlayerHistorySession {
  id: string
  date: string
  description: string | null
  exchange_rate: number
  started_at: string | null
  session_entries: ResultEntry[] // all players in the session, for POG computation
}

export interface LiveSessionData {
  id: string
  date: string
  description: string | null
  exchange_rate: number
  buy_in_unit: number
  started_at: string | null
  status: SessionStatus
  participants: LiveParticipant[]
}

export interface LiveParticipant {
  player_id: string
  name: string
  total_buyin: number
  buy_ins: LiveBuyIn[]
  final_chips: number | null
  settled_at: string | null
}

export interface LiveBuyIn {
  id: string
  player_id: string
  amount: number
  created_at: string
}

export interface SessionForEdit {
  date: string
  exchange_rate: number
  description: string | null
  status: SessionStatus
  ended_at: string | null
  participants: EditParticipant[]
}

export interface EditParticipant {
  player_id: string
  name: string
  final_chips: number | null
  buy_ins: EditBuyIn[]
}

export interface EditBuyIn { id: string; amount: number; created_at: string }

export interface SessionDetail {
  id: string
  date: string
  description: string | null
  exchange_rate: number
  status: SessionStatus
  started_at: string | null
  ended_at: string | null
  session_entries: SessionDetailEntry[]
}

export interface SessionDetailEntry {
  id: string
  player_id: string
  chips: number
  final_chips: number | null
  total_buyin: number
  buy_ins: { amount: number; created_at: string }[]
  settled_at: string | null
  players: { name: string } | null
}

export interface SessionsPage {
  sessions: SessionRow[]
  page: number
  page_size: number
  total: number
  total_pages: number
}

export interface SessionRow {
  id: string
  date: string
  description: string | null
  exchange_rate: number
  status: 'OPEN' | 'SETTLED'
  player_count: number
  winners: Array<{ name: string; player_id: string }>
}

export interface LeaderboardData {
  players: Player[]
  sessions: LeaderboardSessionRow[]
}

export interface LeaderboardSessionRow {
  id: string
  date: string
  exchange_rate: number
  session_entries: ResultEntry[]
}

export interface ResultEntry {
  player_id: string
  chips: number
  final_chips: number | null
  total_buyin: number
  buy_in_count: number
}

export type SessionPageData =
  | { status: 'OPEN'; session: LiveSessionData }
  | { status: 'SETTLED'; session: SessionDetail }
