import { ApiError } from './http'
import type {
  BuyInCommand,
  CashOutParticipantCommand,
  CreateSessionCommand,
  EditedParticipant,
  FinalEntry,
  GroupPlayerCommand,
  NameCommand,
  PasswordCommand,
  SessionMetaCommand,
  SettleSessionCommand,
  UpdateSessionCommand,
} from './contracts'

type JsonObject = Record<string, unknown>

function invalid(message: string): never {
  throw new ApiError(400, message)
}

function object(value: unknown, field = 'body'): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(`${field} must be an object`)
  return value as JsonObject
}

function string(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`)
  return value
}

function number(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(`${field} must be a finite number`)
  return value
}

function integer(value: unknown, field: string, minimum?: number): number {
  const parsed = number(value, field)
  if (!Number.isInteger(parsed) || (minimum !== undefined && parsed < minimum)) {
    invalid(`${field} must be an integer${minimum !== undefined ? ` >= ${minimum}` : ''}`)
  }
  return parsed
}

function array(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) invalid(`${field} must be an array`)
  return value
}

function boolean(value: unknown, field: string, fallback = false): boolean {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') invalid(`${field} must be a boolean`)
  return value
}

function date(value: unknown): string {
  const parsed = string(value, 'date')
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(parsed)
  if (!match) invalid('date must use YYYY-MM-DD')
  const [, year, month, day] = match
  const timestamp = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (timestamp.toISOString().slice(0, 10) !== parsed) invalid('date must be a valid calendar date')
  return parsed
}

function description(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string') invalid('description must be a string or null')
  return value
}

function optionalTimestamp(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) invalid(`${field} must be an ISO timestamp`)
  return value
}

function sessionMeta(body: JsonObject): SessionMetaCommand {
  const exchangeRate = number(body.exchange_rate, 'exchange_rate')
  if (exchangeRate <= 0) invalid('exchange_rate must be greater than 0')
  return {
    date: date(body.date),
    exchange_rate: exchangeRate,
    description: description(body.description),
  }
}

export async function readCommand<T>(request: Request, parse: (value: unknown) => T): Promise<T> {
  let value: unknown
  try {
    value = await request.json()
  } catch {
    invalid('Invalid JSON body')
  }
  return parse(value)
}

export function parseNameCommand(value: unknown): NameCommand {
  const body = object(value)
  return { name: string(body.name, 'name') }
}

export function parsePasswordCommand(value: unknown): PasswordCommand {
  const body = object(value)
  return { password: string(body.password, 'password') }
}

export function parseGroupPlayerCommand(value: unknown): GroupPlayerCommand {
  const body = object(value)
  return { player_id: string(body.player_id, 'player_id') }
}

export function parseCreateSessionCommand(value: unknown): CreateSessionCommand {
  const body = object(value)
  const meta = sessionMeta(body)
  if (body.status === 'OPEN') {
    return {
      ...meta,
      status: 'OPEN',
      players: array(body.players, 'players').map((value, index) => {
        const player = object(value, `players[${index}]`)
        return {
          player_id: string(player.player_id, `players[${index}].player_id`),
          initial_buyin: integer(player.initial_buyin, `players[${index}].initial_buyin`, 1),
        }
      }),
    }
  }
  if (body.status === 'SETTLED') {
    return {
      ...meta,
      status: 'SETTLED',
      entries: array(body.entries, 'entries').map((value, index) => {
        const entry = object(value, `entries[${index}]`)
        return {
          player_id: string(entry.player_id, `entries[${index}].player_id`),
          chips: integer(entry.chips, `entries[${index}].chips`),
        }
      }),
    }
  }
  invalid('status must be OPEN or SETTLED')
}

function parseEditedParticipant(value: unknown, index: number): EditedParticipant {
  const participant = object(value, `participants[${index}]`)
  return {
    player_id: string(participant.player_id, `participants[${index}].player_id`),
    final_chips: integer(participant.final_chips, `participants[${index}].final_chips`, 0),
    buy_ins: array(participant.buy_ins, `participants[${index}].buy_ins`).map((value, buyInIndex) => {
      const buyIn = object(value, `participants[${index}].buy_ins[${buyInIndex}]`)
      const createdAt = optionalTimestamp(buyIn.created_at, `participants[${index}].buy_ins[${buyInIndex}].created_at`)
      return {
        amount: integer(buyIn.amount, `participants[${index}].buy_ins[${buyInIndex}].amount`, 1),
        ...(createdAt === undefined ? {} : { created_at: createdAt }),
      }
    }),
  }
}

export function parseUpdateSessionCommand(value: unknown): UpdateSessionCommand {
  const body = object(value)
  return {
    ...sessionMeta(body),
    participants: array(body.participants, 'participants').map(parseEditedParticipant),
    force: boolean(body.force, 'force'),
  }
}

export function parseBuyInCommand(value: unknown): BuyInCommand {
  const body = object(value)
  return {
    player_id: string(body.player_id, 'player_id'),
    amount: integer(body.amount, 'amount', 1),
  }
}

export function parseCashOutParticipantCommand(value: unknown): CashOutParticipantCommand {
  const body = object(value)
  return {
    player_id: string(body.player_id, 'player_id'),
    final_chips: integer(body.final_chips, 'final_chips', 0),
  }
}

function parseFinalEntry(value: unknown, index: number): FinalEntry {
  const final = object(value, `finals[${index}]`)
  return {
    player_id: string(final.player_id, `finals[${index}].player_id`),
    final_chips: integer(final.final_chips, `finals[${index}].final_chips`, 0),
  }
}

export function parseSettleSessionCommand(value: unknown): SettleSessionCommand {
  const body = object(value)
  return {
    finals: array(body.finals, 'finals').map(parseFinalEntry),
    force: boolean(body.force, 'force'),
  }
}
