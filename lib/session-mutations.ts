import { DEFAULT_EXCHANGE_RATE, BUY_IN_UNIT } from './session-rules'
import { db } from './db'
import { DomainError } from './domain-error'
import { synthFromNet } from './synth'
import { buyinSum } from './settlement'
import { requireConservation, requireNonNegativeInteger, requirePositiveInteger } from './session-policy'
import { ensure, ensureData, now, requireActiveMembers, requireGroup, requireSession, requireUniquePlayerIds } from './mutation-guards'
import type { EditedParticipant, ImportEntry, SessionMetaCommand as SessionMeta, StartingPlayer } from './contracts'

export async function importSession(groupId: string, meta: SessionMeta, entries: ImportEntry[]) {
  if (!entries?.length) throw new DomainError('invalid_input', 'At least one player required')
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
  if (!players.length) throw new DomainError('invalid_input', 'At least one player required')
  requireUniquePlayerIds(players.map(player => player.player_id))
  for (const player of players) {
    if (!player.player_id) throw new DomainError('invalid_input', 'player_id required')
    requirePositiveInteger(player.initial_buyin, 'initial_buyin')
  }
  await Promise.all([requireGroup(groupId), requireActiveMembers(groupId, players.map(player => player.player_id))])

  const { data: session, error } = await db.from('session').insert({
    group_id: groupId,
    date: meta.date,
    exchange_rate: meta.exchange_rate ?? DEFAULT_EXCHANGE_RATE,
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
    db.from('buy_in').insert(buyIns),
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
  if (session.status !== 'SETTLED') throw new DomainError('conflict', 'Session is not settled')
  if (!participants?.length) throw new DomainError('invalid_input', 'At least one player required')
  requireUniquePlayerIds(participants.map(participant => participant.player_id))
  for (const participant of participants) {
    if (!participant.player_id) throw new DomainError('invalid_input', 'player_id required')
    requireNonNegativeInteger(participant.final_chips, `final_chips for ${participant.player_id}`)
    for (const buyIn of participant.buy_ins) requirePositiveInteger(buyIn.amount, `buy-in amount for ${participant.player_id}`)
  }

  const [participantResult, buyInResult] = await Promise.all([
    db.from('session_participant').select('id, player_id, final_chips, settled_at, deleted_at').eq('session_id', id),
    db.from('buy_in').select('id, player_id, amount, created_at, deleted_at').eq('session_id', id),
  ])
  ensure(participantResult.error)
  ensure(buyInResult.error)
  const existingParticipants = participantResult.data ?? []
  const existingBuyIns = buyInResult.data ?? []
  const byPlayer = new Map(existingParticipants.map(row => [row.player_id, row]))
  const byBuyInId = new Map(existingBuyIns.map(row => [row.id, row]))
  const retainedBuyIns = new Set<string>()
  const retainedPlayers = new Set(participants.map(row => row.player_id))

  // Validate the entire command before writing. A buy-in ID may never move to
  // another player/session or revive a revoked event via an edit payload.
  for (const participant of participants) {
    for (const buyIn of participant.buy_ins) {
      if (!buyIn.id) continue
      const existing = byBuyInId.get(buyIn.id)
      if (!existing || existing.player_id !== participant.player_id || existing.deleted_at !== null) {
        throw new DomainError('conflict', 'Buy-in no longer belongs to this participant. Refresh and try again.')
      }
      if (retainedBuyIns.has(buyIn.id)) throw new DomainError('invalid_input', 'Duplicate buy-in id')
      retainedBuyIns.add(buyIn.id)
    }
  }
  await requireActiveMembers(groupId, participants
    .filter(row => !byPlayer.has(row.player_id) || byPlayer.get(row.player_id)!.deleted_at !== null)
    .map(row => row.player_id))

  const totalBuyin = buyinSum(participants.flatMap(participant => participant.buy_ins))
  const totalFinal = participants.reduce((sum, participant) => sum + participant.final_chips, 0)
  const diff = requireConservation(totalBuyin, totalFinal, force)
  const timestamp = now()

  // Existing events keep their IDs and creation times. Insert only new events,
  // and do not remove anything until the requested updates/inserts succeed.
  for (const participant of participants) {
    const existing = byPlayer.get(participant.player_id)
    const values = {
      final_chips: participant.final_chips,
      settled_at: existing?.settled_at ?? session.ended_at ?? timestamp,
      deleted_at: null,
      updated_at: timestamp,
    }
    if (existing) {
      if (existing.final_chips !== values.final_chips || existing.deleted_at !== null || existing.settled_at !== values.settled_at) {
        const { data, error } = await db.from('session_participant').update(values)
          .eq('session_id', id).eq('id', existing.id).select('id').maybeSingle()
        ensure(error)
        if (!data) throw new DomainError('conflict', 'Participant changed. Refresh and try again.')
      }
    } else {
      const { error } = await db.from('session_participant').insert({ ...values, session_id: id, player_id: participant.player_id })
      ensure(error)
    }
    for (const buyIn of participant.buy_ins) {
      const existingBuyIn = buyIn.id ? byBuyInId.get(buyIn.id)! : undefined
      if (existingBuyIn) {
        if (buyIn.amount !== existingBuyIn.amount || (buyIn.created_at !== undefined && Date.parse(buyIn.created_at) !== Date.parse(existingBuyIn.created_at))) {
          const { data, error } = await db.from('buy_in').update({
            amount: buyIn.amount,
            ...(buyIn.created_at === undefined ? {} : { created_at: buyIn.created_at }),
            updated_at: timestamp,
          }).eq('session_id', id).eq('player_id', participant.player_id).eq('id', existingBuyIn.id)
            .is('deleted_at', null).select('id').maybeSingle()
          ensure(error)
          if (!data) throw new DomainError('conflict', 'Buy-in changed. Refresh and try again.')
        }
      } else {
        const { error } = await db.from('buy_in').insert({
          session_id: id, player_id: participant.player_id, amount: buyIn.amount,
          ...(buyIn.created_at === undefined ? {} : { created_at: buyIn.created_at }),
        })
        ensure(error)
      }
    }
  }
  const removedBuyIns = existingBuyIns.filter(row => row.deleted_at === null && !retainedBuyIns.has(row.id)).map(row => row.id)
  if (removedBuyIns.length) {
    const { error } = await db.from('buy_in').update({ deleted_at: timestamp, updated_at: timestamp })
      .eq('session_id', id).in('id', removedBuyIns).is('deleted_at', null)
    ensure(error)
  }
  const removedParticipants = existingParticipants.filter(row => row.deleted_at === null && !retainedPlayers.has(row.player_id)).map(row => row.id)
  if (removedParticipants.length) {
    const { error } = await db.from('session_participant').update({ deleted_at: timestamp, updated_at: timestamp })
      .eq('session_id', id).in('id', removedParticipants).is('deleted_at', null)
    ensure(error)
  }
  const { error } = await db.from('session').update({ date: meta.date, exchange_rate: meta.exchange_rate,
    description: meta.description || null, updated_at: timestamp }).eq('group_id', groupId).eq('id', id)
  ensure(error)
  return { id, diff }
}

export async function softDeleteSession(groupId: string, id: string): Promise<void> {
  await requireSession(groupId, id)
  const timestamp = now()
  const { error } = await db.from('session').update({ deleted_at: timestamp, updated_at: timestamp }).eq('id', id)
  ensure(error)
}
