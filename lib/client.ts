// Client-side adapter for the route interface. URL, method, command and
// response types stay private to these named operations so callers cannot
// claim an arbitrary response shape.

import type {
  BuyInCommand,
  GroupPlayerCommand,
  ImportSessionCommand,
  NameCommand,
  PasswordCommand,
  SettleSessionCommand,
  StartSessionCommand,
  UpdateSessionCommand,
} from './contracts'
import type { Group, GroupPlayer, Player } from '@/types'

export class ApiClientError extends Error {
  status: number
  payload: Record<string, unknown>

  constructor(status: number, payload: Record<string, unknown>) {
    super(typeof payload.error === 'string' ? payload.error : 'Request failed')
    this.status = status
    this.payload = payload
  }
}

async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    ...(body !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  })
  if (res.status === 204) return undefined as T
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiClientError(res.status, payload)
  return payload as T
}

// Keep the create-player wire shape at one seam. Callers that only need the
// player id no longer need to know that the route also returns group_player.
export function createPlayerInGroup(groupId: string, name: string): Promise<{
  player: Player
  group_player: GroupPlayer
}> {
  return request('POST', `/api/groups/${groupId}/players`, { name } satisfies NameCommand)
}

export const login = (password: string) =>
  request<{ ok: true }>('POST', '/api/auth', { password } satisfies PasswordCommand)

export const logout = () => request<{ ok: true }>('DELETE', '/api/auth')

export const listGroups = () => request<Group[]>('GET', '/api/groups')

export const createGroup = (name: string) =>
  request<Group>('POST', '/api/groups', { name } satisfies NameCommand)

export const renameGroup = (groupId: string, name: string) =>
  request<Group>('PATCH', `/api/groups/${groupId}`, { name } satisfies NameCommand)

export const listPlayers = (groupId: string) =>
  request<Player[]>('GET', `/api/groups/${groupId}/players`)

export const renamePlayer = (groupId: string, playerId: string, name: string) =>
  request<Player>('PATCH', `/api/groups/${groupId}/players/${playerId}`, { name } satisfies NameCommand)

export const addGroupPlayer = (groupId: string, playerId: string) =>
  request<GroupPlayer>('POST', `/api/groups/${groupId}/group-players`, { player_id: playerId } satisfies GroupPlayerCommand)

export const deleteGroupPlayer = (groupId: string, playerId: string) =>
  request<GroupPlayer>('DELETE', `/api/groups/${groupId}/group-players`, { player_id: playerId } satisfies GroupPlayerCommand)

export const importSession = (groupId: string, command: ImportSessionCommand) =>
  request<{ id: string }>('POST', `/api/groups/${groupId}/sessions`, command)

export const startSession = (groupId: string, command: StartSessionCommand) =>
  request<{ id: string }>('POST', `/api/groups/${groupId}/sessions`, command)

export const updateSession = (groupId: string, sessionId: string, command: UpdateSessionCommand) =>
  request<{ id: string; diff: number }>('PUT', `/api/groups/${groupId}/sessions/${sessionId}`, command)

export const deleteSession = (groupId: string, sessionId: string) =>
  request<void>('DELETE', `/api/groups/${groupId}/sessions/${sessionId}`)

export const addBuyIn = (groupId: string, sessionId: string, command: BuyInCommand) =>
  request('POST', `/api/groups/${groupId}/sessions/${sessionId}/buyin`, command)

export const revokeBuyIn = (groupId: string, sessionId: string, buyInId: string) =>
  request<void>('DELETE', `/api/groups/${groupId}/sessions/${sessionId}/buyin/${buyInId}`)

export const removeSessionParticipant = (groupId: string, sessionId: string, playerId: string) =>
  request<void>('DELETE', `/api/groups/${groupId}/sessions/${sessionId}/participant`, { player_id: playerId } satisfies GroupPlayerCommand)

export const settleSession = (groupId: string, sessionId: string, command: SettleSessionCommand) =>
  request<{ id: string; diff: number }>('POST', `/api/groups/${groupId}/sessions/${sessionId}/settle`, command)
