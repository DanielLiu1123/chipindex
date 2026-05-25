export interface Player {
  id: string
  name: string
  created_at: string
}

export interface SessionEntry {
  id: string
  session_id: string
  player_id: string
  chips: number
  players?: Player
}

export interface PlayerStats {
  player: Player
  total_chips: number
  sessions_played: number
  wins: number
  win_rate: number
}
