import { db } from './db'
import { ApiError } from './http'
import { synthFromNet, BUY_IN_UNIT } from './synth'
import { buyinSum } from './settlement'
import { requireConservation, requireNonNegativeInteger, requirePositiveInteger } from './session-policy'
import { ensure, ensureData, now, requireActiveMembers, requireGroup, requireSession, requireUniquePlayerIds } from './mutation-guards'
import type { EditedParticipant, ImportEntry, SessionMetaCommand as SessionMeta, StartingPlayer } from './contracts'

export async function importSession(groupId: string, meta: SessionMeta, entries: ImportEntry[]) {
  if (!entries?.length) throw new ApiError(400, 'At least one player required')
  requireUniquePlayerIds(entries.map(entry => entry.player_id))
  await Promise.all([requireGroup(groupId), requireActiveMembers(groupId, entries.map(entry => entry.player_id))])
  const { data: session, error } = await db.from('session').insert({
    group_id: groupId,
    date: meta.date,
    exchange_rate: meta.exchange_rate,
    description: meta.description || null,
    status: 'SETTLED',
    buy_in_unit: BUY_IN_UNIT,
  }).select().single()
  ensureData(session, error)

  const settledAt = now()
  const participants = entries.map(entry => ({
    session_id: session.id,
    player_id: entry.player_id,
    final_chips: synthFromNet(entry.chips).final_chips,
    settled_at: settledAt,
  }))
  const buyIns = entries.map(entry => ({
    session_id: session.id,
    player_id: entry.player_id,
    amount: synthFromNet(entry.chips).amount,
  }))
  const [participantResult, buyInResult] = await Promise.all([
    db.from('session_participant').insert(participants),
    db.from('buy_in').insert(buyIns),
  ])
  ensure(participantResult.error)
  ensure(buyInResult.error)
  return session
}

export async function startSession(groupId: string, meta: SessionMeta, players: StartingPlayer[]) {
  if (!players.length) throw new ApiError(400, 'At least one player required')
  requireUniquePlayerIds(players.map(player => player.player_id))
  for (const player of players) {
    if (!player.player_id) throw new ApiError(400, 'player_id required')
    requirePositiveInteger(player.initial_buyin, 'initial_buyin')
  }
  await Promise.all([requireGroup(groupId), requireActiveMembers(groupId, players.map(player => player.player_id))])

  const { data: session, error } = await db.from('session').insert({
    group_id: groupId,
    date: meta.date,
    exchange_rate: meta.exchange_rate ?? 40,
    description: meta.description || null,
    status: 'OPEN',
    buy_in_unit: BUY_IN_UNIT,
    started_at: now(),
  }).select().single()
  ensureData(session, error)

  const buyIns = players.map(player => ({
    session_id: session.id,
    player_id: player.player_id,
    amount: player.initial_buyin,
  }))
  const [participantResult, buyInResult] = await Promise.all([
    db.from('session_participant').insert(players.map(player => ({ session_id: session.id, player_id: player.player_id }))),
    buyIns.length ? db.from('buy_in').insert(buyIns) : Promise.resolve({ error: null }),
  ])
  ensure(participantResult.error)
  ensure(buyInResult.error)
  return session
}

export async function updateSettledSession(
  groupId: string,
  id: string,
  meta: SessionMeta,
  participants: EditedParticipant[],
  force: boolean,
): Promise<{ id: string; diff: number }> {
  const session = await requireSession(groupId, id)
  if (session.status !== 'SETTLED') throw new ApiError(409, 'Session is not settled')
  if (!participants?.length) throw new ApiError(400, 'At least one player required')
  requireUniquePlayerIds(participants.map(participant => participant.player_id))
  for (const participant of participants) {
    if (!participant.player_id) throw new ApiError(400, 'player_id required')
    requireNonNegativeInteger(participant.final_chips, `final_chips for ${participant.player_id}`)
    for (const buyIn of participant.buy_ins) requirePositiveInteger(buyIn.amount, `buy-in amount for ${participant.player_id}`)
  }

  const { data: existingParticipants, error: existingError } = await db.from('session_participant').select('player_id, settled_at').eq('session_id', id).is('deleted_at', null)
  ensure(existingError)
  const existingIds = new Set((existingParticipants ?? []).map(row => row.player_id))
  const existingSettledAt = new Map((existingParticipants ?? []).map(row => [row.player_id, row.settled_at]))
  await requireActiveMembers(groupId, participants.filter(row => !existingIds.has(row.player_id)).map(row => row.player_id))

  const totalBuyin = buyinSum(participants.flatMap(participant => participant.buy_ins))
  const totalFinal = participants.reduce((sum, participant) => sum + participant.final_chips, 0)
  const diff = requireConservation(totalBuyin, totalFinal, force)
  const timestamp = now()
  const [sessionResult, deleteParticipantsResult, deleteBuyInsResult] = await Promise.all([
    db.from('session').update({ date: meta.date, exchange_rate: meta.exchange_rate, description: meta.description || null, updated_at: timestamp }).eq('id', id),
    db.from('session_participant').delete().eq('session_id', id),
    db.from('buy_in').delete().eq('session_id', id),
  ])
  ensure(sessionResult.error)
  ensure(deleteParticipantsResult.error)
  ensure(deleteBuyInsResult.error)

  const participantRows = participants.map(participant => ({
    session_id: id,
    player_id: participant.player_id,
    final_chips: participant.final_chips,
    settled_at: participant.settled_at ?? existingSettledAt.get(participant.player_id) ?? timestamp,
  }))
  const buyInRows = participants.flatMap(participant => participant.buy_ins.map(buyIn => ({
    session_id: id,
    player_id: participant.player_id,
    amount: buyIn.amount,
    ...(buyIn.created_at ? { created_at: buyIn.created_at } : {}),
  })))
  const [participantResult, buyInResult] = await Promise.all([
    db.from('session_participant').insert(participantRows),
    buyInRows.length ? db.from('buy_in').insert(buyInRows) : Promise.resolve({ error: null }),
  ])
  ensure(participantResult.error)
  ensure(buyInResult.error)
  return { id, diff }
}

export async function softDeleteSession(groupId: string, id: string): Promise<void> {
  await requireSession(groupId, id)
  const timestamp = now()
  const { error } = await db.from('session').update({ deleted_at: timestamp, updated_at: timestamp }).eq('id', id)
  ensure(error)
}
