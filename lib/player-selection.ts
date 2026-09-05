// Picker data does not depend on the server's full live-session query shape.
export interface SelectablePlayer {
  player_id: string
  name: string
  settled_at: string | null
}

export const PLAYER_PAGE_SIZE = 10
