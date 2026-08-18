export interface NameCommand {
  name: string
}

export interface PasswordCommand {
  password: string
}

export interface GroupPlayerCommand {
  player_id: string
}

export interface SessionMetaCommand {
  date: string
  exchange_rate: number
  description: string | null
}

export interface ImportEntry {
  player_id: string
  chips: number
}

export interface StartingPlayer {
  player_id: string
  initial_buyin: number
}

export interface ImportSessionCommand extends SessionMetaCommand {
  status: 'SETTLED'
  entries: ImportEntry[]
}

export interface StartSessionCommand extends SessionMetaCommand {
  status: 'OPEN'
  players: StartingPlayer[]
}

export type CreateSessionCommand = ImportSessionCommand | StartSessionCommand

export interface EditedParticipant {
  player_id: string
  final_chips: number
  buy_ins: Array<{ amount: number; created_at?: string }>
}

export interface UpdateSessionCommand extends SessionMetaCommand {
  participants: EditedParticipant[]
  force: boolean
}

export interface BuyInCommand {
  player_id: string
  amount: number
}

export interface CashOutParticipantCommand {
  player_id: string
  final_chips: number
}

export interface FinalEntry {
  player_id: string
  final_chips: number
}

export interface SettleSessionCommand {
  finals: FinalEntry[]
  force: boolean
}
