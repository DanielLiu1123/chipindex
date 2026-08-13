export interface Player {
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
