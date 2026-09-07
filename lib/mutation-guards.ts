import { db } from './db'
import { DomainError } from './domain-error'

export const now = () => new Date().toISOString()

export function ensure(error: { message: string } | null): void {
  if (error) throw new Error('Database operation failed', { cause: error })
}

export function ensureData<T>(data: T, error: { message: string } | null): asserts data is NonNullable<T> {
  ensure(error)
  if (data == null) throw new Error('Database write returned no data')
}

export async function requireSession(groupId: string, id: string) {
  const { data, error } = await db.from('session').select('status, ended_at').eq('group_id', groupId).eq('id', id).is('deleted_at', null).maybeSingle()
  ensure(error)
  if (!data) throw new DomainError('not_found', 'Session not found')
  return data
}

export async function requireOpenSession(groupId: string, id: string): Promise<void> {
  const session = await requireSession(groupId, id)
  if (session.status !== 'OPEN') throw new DomainError('conflict', 'Session is not open')
}

export async function requireGroup(groupId: string): Promise<void> {
  const { data, error } = await db.from('group').select('id').eq('id', groupId).is('deleted_at', null).maybeSingle()
  ensure(error)
  if (!data) throw new DomainError('not_found', 'Group not found')
}

export async function requirePlayer(playerId: string): Promise<void> {
  const { data, error } = await db.from('player').select('id').eq('id', playerId).is('deleted_at', null).maybeSingle()
  ensure(error)
  if (!data) throw new DomainError('not_found', 'Player not found')
}

export async function requireActiveMembers(groupId: string, playerIds: string[]): Promise<void> {
  const unique = [...new Set(playerIds)]
  if (unique.length === 0) return
  const { data, error } = await db.from('group_player').select('player_id').eq('group_id', groupId).is('deleted_at', null).in('player_id', unique)
  ensure(error)
  const active = new Set((data ?? []).map(row => row.player_id))
  const missing = unique.find(id => !active.has(id))
  if (missing) throw new DomainError('rule_violation', `Player ${missing} is not an active group member`)
}

export function requireUniquePlayerIds(playerIds: string[]): void {
  if (new Set(playerIds).size !== playerIds.length) throw new DomainError('invalid_input', 'Duplicate player_id')
}
