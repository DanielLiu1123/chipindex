import { db } from './db'
import { ApiError } from './http'
import { ensure, now, requireActiveMembers, requireSession } from './mutation-guards'
import type { BatchBuyInCommand } from './contracts'

type Participant = { player_id: string; settled_at: string | null }
type BatchMode = 'buy-in' | 'join'

async function alreadyRecorded(sessionId: string, command: BatchBuyInCommand): Promise<boolean> {
  const { data, error } = await db.from('buy_in')
    .select('id, session_id, player_id, amount, deleted_at')
    .in('id', command.entries.map(entry => entry.id))
  ensure(error)
  if (!data?.length) return false
  const records = new Map(data.map(row => [row.id, row]))
  const matches = command.entries.every(entry => {
    const record = records.get(entry.id)
    return record?.session_id === sessionId && record.player_id === entry.player_id
      && record.amount === command.amount && record.deleted_at === null
  })
  if (data.length !== command.entries.length || !matches) {
    throw new ApiError(409, 'Buy-in request conflicts with existing records. Refresh and check the buy-in history.')
  }
  return true
}

async function readParticipants(sessionId: string, playerIds: string[]): Promise<Map<string, Participant>> {
  const { data, error } = await db.from('session_participant')
    .select('player_id, settled_at').eq('session_id', sessionId).is('deleted_at', null)
    .in('player_id', playerIds)
  ensure(error)
  return new Map((data ?? []).map(row => [row.player_id, row]))
}

function validateParticipants(playerIds: string[], participants: Map<string, Participant>, allowMissing: boolean) {
  for (const playerId of playerIds) {
    const participant = participants.get(playerId)
    if (!participant && !allowMissing) throw new ApiError(422, 'Buy-ins are limited to participants in this session')
    if (participant && participant.settled_at !== null) throw new ApiError(409, 'Cashed-out participant cannot buy in')
  }
}

async function prepareParticipants(groupId: string, sessionId: string, playerIds: string[], mode: BatchMode) {
  const participants = await readParticipants(sessionId, playerIds)
  validateParticipants(playerIds, participants, mode === 'join')
  if (mode !== 'join') return
  await requireActiveMembers(groupId, playerIds)
  const missing = playerIds.filter(id => !participants.has(id))
  if (!missing.length) return

  // A concurrent join must not overwrite a participant who has since cashed out.
  const { error: insertError } = await db.from('session_participant').upsert(
    missing.map(player_id => ({ session_id: sessionId, player_id })),
    { onConflict: 'session_id,player_id', ignoreDuplicates: true },
  )
  ensure(insertError)
  // Only revive deleted rows. Active rows (including concurrent cash-outs) stay untouched.
  const { error: restoreError } = await db.from('session_participant')
    .update({ deleted_at: null, final_chips: null, settled_at: null, updated_at: now() })
    .eq('session_id', sessionId).in('player_id', missing).not('deleted_at', 'is', null)
  ensure(restoreError)
  validateParticipants(playerIds, await readParticipants(sessionId, playerIds), false)
}

async function recordBatch(groupId: string, sessionId: string, command: BatchBuyInCommand, mode: BatchMode) {
  // Verify ownership before accepting a replay, including after settlement.
  const session = await requireSession(groupId, sessionId)
  if (await alreadyRecorded(sessionId, command)) return { count: command.entries.length }
  if (session.status !== 'OPEN') throw new ApiError(409, 'Session is not open')
  await prepareParticipants(groupId, sessionId, command.entries.map(entry => entry.player_id), mode)

  // The buy-in rows are one atomic INSERT. Participant preparation is separate;
  // stable IDs allow retry after either a partial join or a lost response.
  const rows = command.entries.map(entry => ({ ...entry, session_id: sessionId, amount: command.amount }))
  const { error } = await db.from('buy_in').insert(rows)
  if (error?.code === '23505' && await alreadyRecorded(sessionId, command)) return { count: command.entries.length }
  ensure(error)
  return { count: command.entries.length }
}

export async function addBatchBuyin(groupId: string, sessionId: string, command: BatchBuyInCommand) {
  return recordBatch(groupId, sessionId, command, 'buy-in')
}

export async function addBatchParticipants(groupId: string, sessionId: string, command: BatchBuyInCommand) {
  return recordBatch(groupId, sessionId, command, 'join')
}
