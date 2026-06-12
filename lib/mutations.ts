import { db } from './db'
import { ApiError } from './http'
import { synthFromNet, BUY_IN_UNIT } from './synth'
import { buyinSum, checkConservation } from './settlement'
import type { Player } from '@/types'

// Write-side counterpart of queries.ts: every table write goes through here.
// Input validation and domain invariants (session must be OPEN, conservation
// check) are enforced in this module; routes only parse and translate.
// Domain failures are signalled with ApiError, which the route shell turns
// into the matching JSON response.

const now = () => new Date().toISOString()

function ensure(error: { message: string } | null): void {
  if (error) throw new ApiError(500, error.message)
}

async function requireOpenSession(id: string): Promise<void> {
  const { data: session } = await db.from('session').select('status').eq('id', id).single()
  if (!session) throw new ApiError(404, 'Session not found')
  if (session.status !== 'OPEN') throw new ApiError(409, 'Session is not open')
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

export async function createPlayer(name: string): Promise<Player> {
  const trimmed = name?.trim()
  if (!trimmed) throw new ApiError(400, 'Name required')
  const { data, error } = await db.from('player').insert({ name: trimmed }).select().single()
  ensure(error)
  return data as Player
}

export async function renamePlayer(id: string, name: string): Promise<Player> {
  const trimmed = name?.trim()
  if (!trimmed) throw new ApiError(400, 'Name required')
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
export async function importSession(meta: SessionMeta, entries: ImportEntry[]) {
  const { data: session, error } = await db
    .from('session')
    .insert({
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
export async function startSession(meta: SessionMeta, players: StartingPlayer[]) {
  if (players.length === 0) throw new ApiError(400, 'At least one player required')
  for (const p of players) {
    if (!p.player_id) throw new ApiError(400, 'player_id required')
    if (!Number.isInteger(p.initial_buyin) || p.initial_buyin < 0) {
      throw new ApiError(400, 'initial_buyin must be a non-negative integer')
    }
  }

  const { data: session, error } = await db
    .from('session')
    .insert({
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
  id: string,
  meta: SessionMeta,
  participants: EditedParticipant[],
  force: boolean,
): Promise<{ id: string; diff: number }> {
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

export async function softDeleteSession(id: string): Promise<void> {
  const ts = now()
  const { error } = await db
    .from('session')
    .update({ deleted_at: ts, updated_at: ts })
    .eq('id', id)
  ensure(error)
}

// ── participants & buy-ins (live session) ──────────────────────

export async function addParticipant(sessionId: string, playerId: string) {
  if (!playerId) throw new ApiError(400, 'player_id required')
  await requireOpenSession(sessionId)
  const { data, error } = await db
    .from('session_participant')
    .upsert({ session_id: sessionId, player_id: playerId }, { onConflict: 'session_id,player_id', ignoreDuplicates: true })
    .select()
  ensure(error)
  return data?.[0] ?? null
}

// Soft-delete the participant together with all their buy-ins.
export async function removeParticipant(sessionId: string, playerId: string): Promise<void> {
  if (!playerId) throw new ApiError(400, 'player_id required')
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
export async function addBuyin(sessionId: string, playerId: string, amount: number) {
  if (!playerId) throw new ApiError(400, 'player_id required')
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ApiError(400, 'amount must be a positive integer')
  }
  await requireOpenSession(sessionId)

  const { error: pErr } = await db
    .from('session_participant')
    .upsert({ session_id: sessionId, player_id: playerId }, { onConflict: 'session_id,player_id', ignoreDuplicates: true })
  ensure(pErr)

  const { data, error } = await db
    .from('buy_in')
    .insert({ session_id: sessionId, player_id: playerId, amount })
    .select()
    .single()
  ensure(error)
  return data
}

export async function revokeBuyin(sessionId: string, buyinId: string): Promise<void> {
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
  sessionId: string,
  finals: FinalEntry[],
  force: boolean,
): Promise<{ id: string; diff: number }> {
  await requireOpenSession(sessionId)

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
