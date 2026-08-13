import { db } from './db'
import { ApiError } from './http'
import { synthFromNet, BUY_IN_UNIT } from './synth'
import { buyinSum, checkConservation } from './settlement'
import type { Group, GroupPlayer, Player } from '@/types'

// Write-side counterpart of queries.ts: every table write goes through here.
// Input validation and domain invariants (session must be OPEN, conservation
// check) are enforced in this module; routes only parse and translate.
// Domain failures are signalled with ApiError, which the route shell turns
// into the matching JSON response.

const now = () => new Date().toISOString()

function ensure(error: { message: string } | null): void {
  if (error) throw new ApiError(500, error.message)
}

async function requireSession(groupId: string, id: string): Promise<{ status: string }> {
  const { data: session } = await db.from('session').select('status').eq('group_id', groupId).eq('id', id).is('deleted_at', null).maybeSingle()
  if (!session) throw new ApiError(404, 'Session not found')
  return session as { status: string }
}

async function requireGroup(groupId: string): Promise<void> {
  const { data, error } = await db
    .from('group')
    .select('id')
    .eq('id', groupId)
    .is('deleted_at', null)
    .maybeSingle()
  ensure(error)
  if (!data) throw new ApiError(404, 'Group not found')
}

async function requirePlayer(playerId: string): Promise<void> {
  const { data, error } = await db
    .from('player')
    .select('id')
    .eq('id', playerId)
    .is('deleted_at', null)
    .maybeSingle()
  ensure(error)
  if (!data) throw new ApiError(404, 'Player not found')
}

async function requireOpenSession(groupId: string, id: string): Promise<void> {
  const session = await requireSession(groupId, id)
  if (session.status !== 'OPEN') throw new ApiError(409, 'Session is not open')
}

async function requireActiveMembers(groupId: string, playerIds: string[]): Promise<void> {
  const unique = [...new Set(playerIds)]
  if (unique.length === 0) return
  const { data, error } = await db
    .from('group_player')
    .select('player_id')
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .in('player_id', unique)
  ensure(error)
  const active = new Set(((data ?? []) as { player_id: string }[]).map(row => row.player_id))
  const missing = unique.find(id => !active.has(id))
  if (missing) throw new ApiError(422, `Player ${missing} is not an active group member`)
}

// ── group & group_player ─────────────────────────────────────

export async function createGroup(name: string): Promise<Group> {
  const trimmed = name?.trim()
  if (!trimmed) throw new ApiError(400, 'Name required')
  const { data, error } = await db.from('group').insert({ name: trimmed }).select().single()
  if (error?.code === '23505') throw new ApiError(409, 'Group name already exists')
  ensure(error)
  return data as Group
}

export async function renameGroup(id: string, name: string): Promise<Group> {
  const trimmed = name?.trim()
  if (!trimmed) throw new ApiError(400, 'Name required')
  const { data, error } = await db
    .from('group')
    .update({ name: trimmed, updated_at: now() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .maybeSingle()
  if (error?.code === '23505') throw new ApiError(409, 'Group name already exists')
  ensure(error)
  if (!data) throw new ApiError(404, 'Group not found')
  return data as Group
}

async function setGroupPlayerDeletedAt(groupId: string, playerId: string, deletedAt: string | null): Promise<GroupPlayer> {
  if (!playerId) throw new ApiError(400, 'player_id required')
  await Promise.all([requireGroup(groupId), requirePlayer(playerId)])
  const ts = deletedAt ?? now()
  const { data, error } = await db
    .from('group_player')
    .upsert({
      group_id: groupId,
      player_id: playerId,
      updated_at: ts,
      deleted_at: deletedAt,
    }, { onConflict: 'group_id,player_id' })
    .select()
    .single()
  ensure(error)
  return data as GroupPlayer
}

export async function restoreGroupPlayer(groupId: string, playerId: string): Promise<GroupPlayer> {
  return setGroupPlayerDeletedAt(groupId, playerId, null)
}

export async function softDeleteGroupPlayer(groupId: string, playerId: string): Promise<GroupPlayer> {
  return setGroupPlayerDeletedAt(groupId, playerId, now())
}

// Conservation check shared by settle and edit. Throws 422 with the diff
// unless the caller explicitly forces an unbalanced write.
function requireConservation(totalBuyin: number, totalFinal: number, force: boolean): number {
  const result = checkConservation(totalBuyin, totalFinal)
  if (!result.balanced && !force) {
    throw new ApiError(422, 'unbalanced', {
      diff: result.diff,
      total_buyin: result.total_buyin,
      total_final: result.total_final,
    })
  }
  return result.diff
}

// ── players ────────────────────────────────────────────────────

export async function createPlayer(name: string, groupId: string): Promise<{ player: Player; group_player: GroupPlayer }> {
  const trimmed = name?.trim()
  if (!trimmed) throw new ApiError(400, 'Name required')
  await requireGroup(groupId)
  const { data, error } = await db.from('player').insert({ name: trimmed }).select().single()
  ensure(error)
  const player = data as Player
  const group_player = await restoreGroupPlayer(groupId, player.id)
  return { player, group_player }
}

export async function renamePlayer(groupId: string, id: string, name: string): Promise<Player> {
  const trimmed = name?.trim()
  if (!trimmed) throw new ApiError(400, 'Name required')
  const { data: groupPlayer } = await db.from('group_player').select('id').eq('group_id', groupId).eq('player_id', id).maybeSingle()
  if (!groupPlayer) throw new ApiError(404, 'Player not found in group')
  const { data, error } = await db
    .from('player')
    .update({ name: trimmed, updated_at: now() })
    .eq('id', id)
    .select()
    .single()
  ensure(error)
  return data as Player
}

// ── sessions ───────────────────────────────────────────────────

export interface SessionMeta {
  date: string
  exchange_rate: number
  description: string | null
}

export interface ImportEntry {
  player_id: string
  chips: number
}

// Import a finished session after the fact: only each player's net result is
// known, so synthFromNet constructs a buy-in + final chips pair per player.
export async function importSession(groupId: string, meta: SessionMeta, entries: ImportEntry[]) {
  if (!entries || entries.length === 0) throw new ApiError(400, 'At least one player required')
  await requireGroup(groupId)
  await requireActiveMembers(groupId, entries.map(entry => entry.player_id))
  const { data: session, error } = await db
    .from('session')
    .insert({
      group_id: groupId,
      date: meta.date,
      exchange_rate: meta.exchange_rate,
      description: meta.description || null,
      status: 'SETTLED',
      buy_in_unit: BUY_IN_UNIT,
    })
    .select()
    .single()
  ensure(error)

  const settledAt = now()
  const participants = entries.map(e => {
    const { final_chips } = synthFromNet(e.chips)
    return { session_id: session.id, player_id: e.player_id, final_chips, settled_at: settledAt }
  })
  const buyins = entries.map(e => {
    const { amount } = synthFromNet(e.chips)
    return { session_id: session.id, player_id: e.player_id, amount }
  })

  const [{ error: pErr }, { error: bErr }] = await Promise.all([
    db.from('session_participant').insert(participants),
    db.from('buy_in').insert(buyins),
  ])
  ensure(pErr)
  ensure(bErr)

  return session
}

export interface StartingPlayer {
  player_id: string
  initial_buyin: number
}

// Open a live session: create participants up front, persisting a buy-in row
// only for players whose initial buy-in is non-zero.
export async function startSession(groupId: string, meta: SessionMeta, players: StartingPlayer[]) {
  if (players.length === 0) throw new ApiError(400, 'At least one player required')
  for (const p of players) {
    if (!p.player_id) throw new ApiError(400, 'player_id required')
    if (!Number.isInteger(p.initial_buyin) || p.initial_buyin < 0) {
      throw new ApiError(400, 'initial_buyin must be a non-negative integer')
    }
  }
  await requireGroup(groupId)
  await requireActiveMembers(groupId, players.map(player => player.player_id))

  const { data: session, error } = await db
    .from('session')
    .insert({
      group_id: groupId,
      date: meta.date,
      exchange_rate: meta.exchange_rate ?? 40,
      description: meta.description || null,
      status: 'OPEN',
      buy_in_unit: BUY_IN_UNIT,
      started_at: now(),
    })
    .select()
    .single()
  ensure(error)

  const buyins = players
    .filter(p => p.initial_buyin > 0)
    .map(p => ({ session_id: session.id, player_id: p.player_id, amount: p.initial_buyin }))
  const [{ error: pErr }, bRes] = await Promise.all([
    db.from('session_participant').insert(players.map(p => ({ session_id: session.id, player_id: p.player_id }))),
    buyins.length > 0 ? db.from('buy_in').insert(buyins) : Promise.resolve({ error: null }),
  ])
  ensure(pErr)
  ensure(bRes.error)

  return session
}

export interface EditedParticipant {
  player_id: string
  final_chips: number
  buy_ins: { amount: number; created_at?: string }[]
}

// Edit a settled session: validate, run the conservation check, then rewrite
// the session's participant and buy_in rows wholesale. Clients send back
// buy_in.created_at to preserve original timestamps.
export async function updateSettledSession(
  groupId: string,
  id: string,
  meta: SessionMeta,
  participants: EditedParticipant[],
  force: boolean,
): Promise<{ id: string; diff: number }> {
  const session = await requireSession(groupId, id)
  if (session.status !== 'SETTLED') throw new ApiError(409, 'Session is not settled')
  if (!participants || participants.length === 0) {
    throw new ApiError(400, 'At least one player required')
  }

  for (const p of participants) {
    if (!p.player_id) throw new ApiError(400, 'player_id required')
    if (!Number.isInteger(p.final_chips) || p.final_chips < 0) {
      throw new ApiError(400, `Invalid final_chips for ${p.player_id}`)
    }
    for (const b of p.buy_ins) {
      if (!Number.isInteger(b.amount) || b.amount <= 0) {
        throw new ApiError(400, `Invalid buy-in amount for ${p.player_id}`)
      }
    }
  }

  const { data: existingParts, error: existingError } = await db
    .from('session_participant')
    .select('player_id')
    .eq('session_id', id)
    .is('deleted_at', null)
  ensure(existingError)
  const existingIds = new Set(((existingParts ?? []) as { player_id: string }[]).map(row => row.player_id))
  await requireActiveMembers(groupId, participants.filter(row => !existingIds.has(row.player_id)).map(row => row.player_id))

  const totalBuyin = buyinSum(participants.flatMap(p => p.buy_ins))
  const totalFinal = participants.reduce((s, p) => s + p.final_chips, 0)
  const diff = requireConservation(totalBuyin, totalFinal, force)

  // The deletes must finish before the inserts below; the session metadata
  // update is independent, so it joins the same round trip.
  const ts = now()
  const [{ error: updateError }, { error: delP }, { error: delB }] = await Promise.all([
    db.from('session')
      .update({
        date: meta.date,
        exchange_rate: meta.exchange_rate,
        description: meta.description || null,
        updated_at: ts,
      })
      .eq('id', id),
    db.from('session_participant').delete().eq('session_id', id),
    db.from('buy_in').delete().eq('session_id', id),
  ])
  ensure(updateError)
  ensure(delP)
  ensure(delB)

  const participantRows = participants.map(p => ({
    session_id: id,
    player_id: p.player_id,
    final_chips: p.final_chips,
    settled_at: ts,
  }))
  const buyinRows = participants.flatMap(p =>
    p.buy_ins.map(b => ({
      session_id: id,
      player_id: p.player_id,
      amount: b.amount,
      ...(b.created_at ? { created_at: b.created_at } : {}),
    }))
  )
  const [{ error: pErr }, bRes] = await Promise.all([
    db.from('session_participant').insert(participantRows),
    buyinRows.length > 0 ? db.from('buy_in').insert(buyinRows) : Promise.resolve({ error: null }),
  ])
  ensure(pErr)
  ensure(bRes.error)

  return { id, diff }
}

export async function softDeleteSession(groupId: string, id: string): Promise<void> {
  await requireSession(groupId, id)
  const ts = now()
  const { error } = await db
    .from('session')
    .update({ deleted_at: ts, updated_at: ts })
    .eq('id', id)
  ensure(error)
}

// ── participants & buy-ins (live session) ──────────────────────

export async function addParticipant(groupId: string, sessionId: string, playerId: string) {
  if (!playerId) throw new ApiError(400, 'player_id required')
  await requireOpenSession(groupId, sessionId)
  await requireActiveMembers(groupId, [playerId])
  const { data, error } = await db
    .from('session_participant')
    .upsert({ session_id: sessionId, player_id: playerId, deleted_at: null, updated_at: now() }, { onConflict: 'session_id,player_id' })
    .select()
  ensure(error)
  return data?.[0] ?? null
}

// Soft-delete the participant together with all their buy-ins.
export async function removeParticipant(groupId: string, sessionId: string, playerId: string): Promise<void> {
  if (!playerId) throw new ApiError(400, 'player_id required')
  await requireOpenSession(groupId, sessionId)
  const ts = now()
  const [{ error: pErr }, { error: bErr }] = await Promise.all([
    db.from('session_participant').update({ deleted_at: ts, updated_at: ts }).eq('session_id', sessionId).eq('player_id', playerId),
    db.from('buy_in').update({ deleted_at: ts, updated_at: ts }).eq('session_id', sessionId).eq('player_id', playerId).is('deleted_at', null),
  ])
  ensure(pErr)
  ensure(bErr)
}

// Record a buy-in. The participant is lazily created on their first buy-in,
// so joining a session and buying in are a single call.
export async function addBuyin(groupId: string, sessionId: string, playerId: string, amount: number) {
  if (!playerId) throw new ApiError(400, 'player_id required')
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ApiError(400, 'amount must be a positive integer')
  }
  await requireOpenSession(groupId, sessionId)

  const { data: existing } = await db
    .from('session_participant')
    .select('id')
    .eq('session_id', sessionId)
    .eq('player_id', playerId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!existing) await requireActiveMembers(groupId, [playerId])

  const { error: pErr } = await db
    .from('session_participant')
    .upsert({ session_id: sessionId, player_id: playerId, deleted_at: null, updated_at: now() }, { onConflict: 'session_id,player_id' })
  ensure(pErr)

  const { data, error } = await db
    .from('buy_in')
    .insert({ session_id: sessionId, player_id: playerId, amount })
    .select()
    .single()
  ensure(error)
  return data
}

export async function revokeBuyin(groupId: string, sessionId: string, buyinId: string): Promise<void> {
  await requireOpenSession(groupId, sessionId)
  const ts = now()
  const { error } = await db
    .from('buy_in')
    .update({ deleted_at: ts, updated_at: ts })
    .eq('id', buyinId)
    .eq('session_id', sessionId)
  ensure(error)
}

export interface FinalEntry {
  player_id: string
  final_chips: number
}

// Settle: record each player's final chips, run the conservation check, and
// close the session. force=true settles anyway, keeping an unbalanced record.
export async function settleSession(
  groupId: string,
  sessionId: string,
  finals: FinalEntry[],
  force: boolean,
): Promise<{ id: string; diff: number }> {
  await requireOpenSession(groupId, sessionId)

  const { data: parts } = await db
    .from('session_participant')
    .select('player_id')
    .is('deleted_at', null)
    .eq('session_id', sessionId)
  const participantIds = new Set(((parts ?? []) as { player_id: string }[]).map(p => p.player_id))
  if (participantIds.size === 0) throw new ApiError(400, 'No participants')

  const finalMap = new Map<string, number>()
  for (const f of finals ?? []) {
    if (!Number.isInteger(f.final_chips) || f.final_chips < 0) {
      throw new ApiError(400, `Invalid final_chips for ${f.player_id}`)
    }
    finalMap.set(f.player_id, f.final_chips)
  }
  for (const pid of participantIds) {
    if (!finalMap.has(pid)) throw new ApiError(400, `Missing final_chips for participant ${pid}`)
  }

  const { data: buyins } = await db
    .from('buy_in')
    .select('amount')
    .is('deleted_at', null)
    .eq('session_id', sessionId)
  const totalBuyin = buyinSum((buyins ?? []) as { amount: number }[])
  let totalFinal = 0
  for (const pid of participantIds) totalFinal += finalMap.get(pid)!
  const diff = requireConservation(totalBuyin, totalFinal, force)

  // Each player gets a different final_chips value, so this is one update per
  // participant; run them concurrently instead of serially.
  const ts = now()
  const results = await Promise.all(
    [...participantIds].map(pid =>
      db.from('session_participant')
        .update({ final_chips: finalMap.get(pid)!, settled_at: ts, updated_at: ts })
        .eq('session_id', sessionId)
        .eq('player_id', pid)
        .is('deleted_at', null)
    )
  )
  for (const { error } of results) ensure(error)

  const { error: sErr } = await db
    .from('session')
    .update({ status: 'SETTLED', ended_at: ts, updated_at: ts })
    .eq('id', sessionId)
  ensure(sErr)

  return { id: sessionId, diff }
}
