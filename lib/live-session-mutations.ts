import { db } from './db'
import { ApiError } from './http'
import { buyinSum } from './settlement'
import { requireConservation, requireNonNegativeInteger, requirePositiveInteger } from './session-policy'
import { ensure, now, requireActiveMembers, requireOpenSession, requireUniquePlayerIds } from './mutation-guards'
import type { FinalEntry } from './contracts'

interface ParticipantSettlementRow {
  id: string
  settled_at: string | null
}

async function requireParticipantSettlementState(sessionId: string, playerId: string): Promise<ParticipantSettlementRow> {
  const { data, error } = await db.from('session_participant').select('id, settled_at').eq('session_id', sessionId).eq('player_id', playerId).is('deleted_at', null).maybeSingle()
  ensure(error)
  if (!data) throw new ApiError(404, 'Participant not found')
  return data
}

export async function addParticipant(groupId: string, sessionId: string, playerId: string) {
  if (!playerId) throw new ApiError(400, 'player_id required')
  await requireOpenSession(groupId, sessionId)
  const { data: existing, error: existingError } = await db.from('session_participant').select('id, settled_at').eq('session_id', sessionId).eq('player_id', playerId).is('deleted_at', null).maybeSingle()
  ensure(existingError)
  if (existing && existing.settled_at !== null) throw new ApiError(409, 'Cashed-out participant cannot rejoin')
  await requireActiveMembers(groupId, [playerId])
  const { data, error } = await db.from('session_participant').upsert(
    { session_id: sessionId, player_id: playerId, deleted_at: null, updated_at: now() },
    { onConflict: 'session_id,player_id' },
  ).select()
  ensure(error)
  return data?.[0] ?? null
}

export async function removeParticipant(groupId: string, sessionId: string, playerId: string): Promise<void> {
  if (!playerId) throw new ApiError(400, 'player_id required')
  await requireOpenSession(groupId, sessionId)
  await requireParticipantSettlementState(sessionId, playerId)
  const timestamp = now()
  const [participantResult, buyInResult] = await Promise.all([
    db.from('session_participant').update({ deleted_at: timestamp, updated_at: timestamp }).eq('session_id', sessionId).eq('player_id', playerId),
    db.from('buy_in').update({ deleted_at: timestamp, updated_at: timestamp }).eq('session_id', sessionId).eq('player_id', playerId).is('deleted_at', null),
  ])
  ensure(participantResult.error)
  ensure(buyInResult.error)
}

export async function cashOutParticipant(groupId: string, sessionId: string, playerId: string, finalChips: number) {
  if (!playerId) throw new ApiError(400, 'player_id required')
  requireNonNegativeInteger(finalChips, 'final_chips')
  await requireOpenSession(groupId, sessionId)
  const participant = await requireParticipantSettlementState(sessionId, playerId)
  if (participant.settled_at !== null) throw new ApiError(409, 'Participant has already cashed out')
  const timestamp = now()
  const { data, error } = await db.from('session_participant')
    .update({ final_chips: finalChips, settled_at: timestamp, updated_at: timestamp })
    .eq('session_id', sessionId).eq('player_id', playerId).is('deleted_at', null).is('settled_at', null)
    .select('player_id, final_chips, settled_at').maybeSingle()
  ensure(error)
  if (!data) throw new ApiError(409, 'Participant has already cashed out')
  return data
}

export async function undoParticipantCashOut(groupId: string, sessionId: string, playerId: string) {
  if (!playerId) throw new ApiError(400, 'player_id required')
  await requireOpenSession(groupId, sessionId)
  const participant = await requireParticipantSettlementState(sessionId, playerId)
  if (participant.settled_at === null) throw new ApiError(409, 'Participant has not cashed out')
  const timestamp = now()
  const { data, error } = await db.from('session_participant')
    .update({ final_chips: null, settled_at: null, updated_at: timestamp })
    .eq('session_id', sessionId).eq('player_id', playerId).is('deleted_at', null).not('settled_at', 'is', null)
    .select('player_id, final_chips, settled_at').maybeSingle()
  ensure(error)
  if (!data) throw new ApiError(409, 'Participant has not cashed out')
  return data
}

export async function addBuyin(groupId: string, sessionId: string, playerId: string, amount: number) {
  if (!playerId) throw new ApiError(400, 'player_id required')
  requirePositiveInteger(amount, 'amount')
  await requireOpenSession(groupId, sessionId)
  const { data: existing, error: existingError } = await db.from('session_participant').select('id, settled_at').eq('session_id', sessionId).eq('player_id', playerId).is('deleted_at', null).maybeSingle()
  ensure(existingError)
  if (existing && existing.settled_at !== null) throw new ApiError(409, 'Cashed-out participant cannot buy in')
  if (!existing) await requireActiveMembers(groupId, [playerId])
  const { error: participantError } = await db.from('session_participant').upsert(
    { session_id: sessionId, player_id: playerId, deleted_at: null, updated_at: now() },
    { onConflict: 'session_id,player_id' },
  )
  ensure(participantError)
  const { data, error } = await db.from('buy_in').insert({ session_id: sessionId, player_id: playerId, amount }).select().single()
  ensure(error)
  return data
}

export async function revokeBuyin(groupId: string, sessionId: string, buyinId: string): Promise<void> {
  await requireOpenSession(groupId, sessionId)
  const { data: buyIn, error: buyInError } = await db.from('buy_in').select('player_id').eq('id', buyinId).eq('session_id', sessionId).is('deleted_at', null).maybeSingle()
  ensure(buyInError)
  if (!buyIn) throw new ApiError(404, 'Buy-in not found')
  const participant = await requireParticipantSettlementState(sessionId, buyIn.player_id)
  if (participant.settled_at !== null) throw new ApiError(409, 'Cashed-out participant cannot revoke buy-ins')
  const timestamp = now()
  const { error } = await db.from('buy_in').update({ deleted_at: timestamp, updated_at: timestamp }).eq('id', buyinId).eq('session_id', sessionId)
  ensure(error)
}


export async function settleSession(groupId: string, sessionId: string, finals: FinalEntry[], force: boolean): Promise<{ id: string; diff: number }> {
  await requireOpenSession(groupId, sessionId)
  const { data, error: participantError } = await db.from('session_participant').select('player_id, final_chips, settled_at').is('deleted_at', null).eq('session_id', sessionId)
  ensure(participantError)
  const participants = data ?? []
  if (!participants.length) throw new ApiError(400, 'No participants')

  requireUniquePlayerIds((finals ?? []).map(final => final.player_id))
  const requestedFinals = new Map<string, number>()
  for (const final of finals ?? []) {
    if (!Number.isInteger(final.final_chips) || final.final_chips < 0) throw new ApiError(400, `Invalid final_chips for ${final.player_id}`)
    requestedFinals.set(final.player_id, final.final_chips)
  }

  const finalByPlayer = new Map<string, number>()
  const activePlayerIds: string[] = []
  for (const participant of participants) {
    if (participant.settled_at !== null) {
      if (!Number.isInteger(participant.final_chips) || participant.final_chips == null || participant.final_chips < 0) {
        throw new ApiError(500, `Cashed-out participant ${participant.player_id} has invalid final_chips`)
      }
      const requested = requestedFinals.get(participant.player_id)
      if (requested !== undefined && requested !== participant.final_chips) throw new ApiError(409, `Frozen final_chips do not match for participant ${participant.player_id}`)
      finalByPlayer.set(participant.player_id, participant.final_chips)
      continue
    }
    const requested = requestedFinals.get(participant.player_id)
    if (requested === undefined) throw new ApiError(400, `Missing final_chips for participant ${participant.player_id}`)
    finalByPlayer.set(participant.player_id, requested)
    activePlayerIds.push(participant.player_id)
  }

  const { data: buyIns, error: buyInError } = await db.from('buy_in').select('amount').is('deleted_at', null).eq('session_id', sessionId)
  ensure(buyInError)
  const totalBuyin = buyinSum(buyIns ?? [])
  const totalFinal = participants.reduce((sum, participant) => sum + finalByPlayer.get(participant.player_id)!, 0)
  const diff = requireConservation(totalBuyin, totalFinal, force)
  const timestamp = now()
  const participantResults = await Promise.all(activePlayerIds.map(playerId => db.from('session_participant')
    .update({ final_chips: finalByPlayer.get(playerId)!, settled_at: timestamp, updated_at: timestamp })
    .eq('session_id', sessionId).eq('player_id', playerId).is('deleted_at', null).is('settled_at', null).select('id').maybeSingle()))
  for (const result of participantResults) {
    ensure(result.error)
    if (!result.data) throw new ApiError(409, 'Participant state changed during settlement')
  }
  const { error } = await db.from('session').update({ status: 'SETTLED', ended_at: timestamp, updated_at: timestamp }).eq('id', sessionId)
  ensure(error)
  return { id: sessionId, diff }
}
