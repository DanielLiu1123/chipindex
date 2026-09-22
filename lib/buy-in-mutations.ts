import { db } from './db'
import { DomainError } from './domain-error'
import {
  ensure,
  now,
  requireActiveMembers,
  requireSession,
  requireOpenSession,
} from './mutation-guards'
import { requirePositiveInteger } from './session-policy'
import type { Tables } from './database.types'
import type { BatchBuyInCommand } from './contracts'

type Participant = Tables<'session_participant'>
type ParticipantOperation = 'buy-in' | 'join' | 'legacy-buy-in'

async function alreadyRecorded(
  sessionId: string,
  command: BatchBuyInCommand,
): Promise<boolean> {
  const { data, error } = await db
    .from('buy_in')
    .select('id, session_id, player_id, amount, deleted_at')
    .in(
      'id',
      command.entries.map((entry) => entry.id),
    )
  ensure(error)
  if (!data?.length) return false
  const records = new Map(data.map((row) => [row.id, row]))
  const matches = command.entries.every((entry) => {
    const record = records.get(entry.id)
    return (
      record?.session_id === sessionId &&
      record.player_id === entry.player_id &&
      record.amount === command.amount &&
      record.deleted_at === null
    )
  })
  if (data.length !== command.entries.length || !matches) {
    throw new DomainError(
      'conflict',
      'Buy-in request conflicts with existing records. Refresh and check the buy-in history.',
    )
  }
  return true
}

async function readParticipants(
  sessionId: string,
  playerIds: string[],
): Promise<Map<string, Participant>> {
  const { data, error } = await db
    .from('session_participant')
    .select('*')
    .eq('session_id', sessionId)
    .is('deleted_at', null)
    .in('player_id', playerIds)
  ensure(error)
  return new Map((data ?? []).map((row) => [row.player_id, row]))
}

function validateParticipants(
  playerIds: string[],
  participants: Map<string, Participant>,
  allowMissing: boolean,
) {
  for (const playerId of playerIds) {
    const participant = participants.get(playerId)
    if (!participant && !allowMissing)
      throw new DomainError(
        'rule_violation',
        'Buy-ins are limited to participants in this session',
      )
    if (participant && participant.settled_at !== null)
      throw new DomainError('conflict', 'Cashed-out participant cannot buy in')
  }
}

async function prepareParticipants(
  groupId: string,
  sessionId: string,
  playerIds: string[],
  mode: ParticipantOperation,
) {
  const participants = await readParticipants(sessionId, playerIds)
  validateParticipants(playerIds, participants, mode !== 'buy-in')
  if (mode === 'buy-in') return participants
  const missing = playerIds.filter((id) => !participants.has(id))
  // The legacy single buy-in allows current session players who left the group.
  await requireActiveMembers(
    groupId,
    mode === 'legacy-buy-in' ? missing : playerIds,
  )
  if (!missing.length) return participants

  // A concurrent join must not overwrite a participant who has since cashed out.
  const { error: insertError } = await db.from('session_participant').upsert(
    missing.map((player_id) => ({ session_id: sessionId, player_id })),
    { onConflict: 'session_id,player_id', ignoreDuplicates: true },
  )
  ensure(insertError)
  // Only revive deleted rows. Active rows (including concurrent cash-outs) stay untouched.
  const { error: restoreError } = await db
    .from('session_participant')
    .update({
      deleted_at: null,
      final_chips: null,
      settled_at: null,
      updated_at: now(),
    })
    .eq('session_id', sessionId)
    .in('player_id', missing)
    .not('deleted_at', 'is', null)
  ensure(restoreError)
  const prepared = await readParticipants(sessionId, playerIds)
  validateParticipants(playerIds, prepared, false)
  return prepared
}

async function recordBatch(
  groupId: string,
  sessionId: string,
  command: BatchBuyInCommand,
  mode: 'buy-in' | 'join',
) {
  // Verify ownership before accepting a replay, including after settlement.
  const session = await requireSession(groupId, sessionId)
  if (await alreadyRecorded(sessionId, command))
    return { count: command.entries.length }
  if (session.status !== 'OPEN')
    throw new DomainError('conflict', 'Session is not open')
  await prepareParticipants(
    groupId,
    sessionId,
    command.entries.map((entry) => entry.player_id),
    mode,
  )

  // The buy-in rows are one atomic INSERT. Participant preparation is separate;
  // stable IDs allow retry after either a partial join or a lost response.
  const rows = command.entries.map((entry) => ({
    ...entry,
    session_id: sessionId,
    amount: command.amount,
  }))
  const { error } = await db.from('buy_in').insert(rows)
  if (error?.code === '23505' && (await alreadyRecorded(sessionId, command)))
    return { count: command.entries.length }
  ensure(error)
  return { count: command.entries.length }
}

export async function addBatchBuyin(
  groupId: string,
  sessionId: string,
  command: BatchBuyInCommand,
) {
  return recordBatch(groupId, sessionId, command, 'buy-in')
}

export async function addBatchParticipants(
  groupId: string,
  sessionId: string,
  command: BatchBuyInCommand,
) {
  return recordBatch(groupId, sessionId, command, 'join')
}

// Compatibility operations retain their response shapes and zero-buy-in join.
// They share the same frozen-player checks and safe participant restoration.
export async function addParticipant(
  groupId: string,
  sessionId: string,
  playerId: string,
) {
  if (!playerId) throw new DomainError('invalid_input', 'player_id required')
  await requireOpenSession(groupId, sessionId)
  const participants = await prepareParticipants(
    groupId,
    sessionId,
    [playerId],
    'join',
  )
  return participants.get(playerId)!
}

export async function addBuyin(
  groupId: string,
  sessionId: string,
  playerId: string,
  amount: number,
) {
  if (!playerId) throw new DomainError('invalid_input', 'player_id required')
  requirePositiveInteger(amount, 'amount')
  await requireOpenSession(groupId, sessionId)
  await prepareParticipants(groupId, sessionId, [playerId], 'legacy-buy-in')
  const { data, error } = await db
    .from('buy_in')
    .insert({ session_id: sessionId, player_id: playerId, amount })
    .select()
    .single()
  ensure(error)
  return data
}
