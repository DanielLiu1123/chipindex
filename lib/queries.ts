import { db } from './db'
import { BUY_IN_UNIT } from './synth'
import { buyinSum, netChips } from './settlement'
import type { Player } from '@/types'

// ── Central place for all table reads. Net result chips come from
//    lib/settlement.ts, computed over non-deleted rows (see resultsBySession).
//    Session-level deleted_at/status is filtered on the session table first.

export interface ResultEntry {
  player_id: string
  chips: number
}

// For leaderboard / charts: only settled, non-deleted sessions
export interface LeaderboardSessionRow {
  id: string
  date: string
  exchange_rate: number
  session_entries: ResultEntry[]
}

// Group a session's buy-in rows by player, preserving query order.
function groupByPlayer<T extends { player_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const arr = map.get(row.player_id) ?? []
    arr.push(row)
    map.set(row.player_id, arr)
  }
  return map
}

// Net chips per (session, player), over non-deleted rows.
async function resultsBySession(sessionIds: string[]): Promise<Map<string, ResultEntry[]>> {
  const map = new Map<string, ResultEntry[]>()
  if (sessionIds.length === 0) return map
  const [{ data: parts }, { data: buyins }] = await Promise.all([
    db.from('session_participant').select('session_id, player_id, final_chips').is('deleted_at', null).in('session_id', sessionIds),
    db.from('buy_in').select('session_id, player_id, amount').is('deleted_at', null).in('session_id', sessionIds),
  ])
  const buyinByKey = new Map<string, number>()
  for (const b of (buyins ?? []) as { session_id: string; player_id: string; amount: number }[]) {
    const key = `${b.session_id}|${b.player_id}`
    buyinByKey.set(key, (buyinByKey.get(key) ?? 0) + b.amount)
  }
  for (const p of (parts ?? []) as { session_id: string; player_id: string; final_chips: number | null }[]) {
    const chips = netChips(p.final_chips, buyinByKey.get(`${p.session_id}|${p.player_id}`) ?? 0)
    const arr = map.get(p.session_id) ?? []
    arr.push({ player_id: p.player_id, chips })
    map.set(p.session_id, arr)
  }
  return map
}

async function playerNameMap(): Promise<Map<string, string>> {
  const { data } = await db.from('player').select('id, name').is('deleted_at', null)
  return new Map((data ?? []).map((p: { id: string; name: string }) => [p.id, p.name]))
}

export async function getPlayers(): Promise<Player[]> {
  const { data } = await db.from('player').select('*').is('deleted_at', null).order('name')
  return (data ?? []) as Player[]
}

export async function getLeaderboardSessions(): Promise<LeaderboardSessionRow[]> {
  const { data: sessions } = await db
    .from('session')
    .select('id, date, exchange_rate')
    .is('deleted_at', null)
    .eq('status', 'SETTLED')
    .order('date', { ascending: true })
  const rows = (sessions ?? []) as { id: string; date: string; exchange_rate: number }[]
  const byId = await resultsBySession(rows.map(s => s.id))
  return rows.map(s => ({ ...s, session_entries: byId.get(s.id) ?? [] }))
}

// ── sessions list ──────────────────────────────────────────────
export interface SessionListEntry {
  chips: number
  player_id: string
  players: { name: string } | null
}
export interface SessionListRow {
  id: string
  date: string
  description: string | null
  exchange_rate: number
  session_entries: SessionListEntry[]
}

export async function getSettledSessionsList(): Promise<SessionListRow[]> {
  const { data: sessions } = await db
    .from('session')
    .select('id, date, description, exchange_rate')
    .is('deleted_at', null)
    .eq('status', 'SETTLED')
    .order('date', { ascending: false })
  const rows = (sessions ?? []) as Omit<SessionListRow, 'session_entries'>[]
  const [byId, names] = await Promise.all([resultsBySession(rows.map(s => s.id)), playerNameMap()])
  return rows.map(s => ({
    ...s,
    session_entries: (byId.get(s.id) ?? []).map(e => ({
      chips: e.chips,
      player_id: e.player_id,
      players: { name: names.get(e.player_id) ?? e.player_id },
    })),
  }))
}

export interface OpenSessionRow {
  id: string
  date: string
  description: string | null
  exchange_rate: number
  started_at: string | null
  player_count: number
  total_buyin: number
}

export async function getOpenSessions(): Promise<OpenSessionRow[]> {
  const { data: sessions } = await db
    .from('session')
    .select('id, date, description, exchange_rate, started_at')
    .is('deleted_at', null)
    .eq('status', 'OPEN')
    .order('started_at', { ascending: false })
  const rows = (sessions ?? []) as Omit<OpenSessionRow, 'player_count' | 'total_buyin'>[]
  if (rows.length === 0) return []
  const ids = rows.map(s => s.id)
  const [{ data: parts }, { data: buyins }] = await Promise.all([
    db.from('session_participant').select('session_id, player_id').is('deleted_at', null).in('session_id', ids),
    db.from('buy_in').select('session_id, amount').is('deleted_at', null).in('session_id', ids),
  ])
  const counts = new Map<string, number>()
  for (const p of (parts ?? []) as { session_id: string }[]) counts.set(p.session_id, (counts.get(p.session_id) ?? 0) + 1)
  const totals = new Map<string, number>()
  for (const b of (buyins ?? []) as { session_id: string; amount: number }[]) totals.set(b.session_id, (totals.get(b.session_id) ?? 0) + b.amount)
  return rows.map(s => ({ ...s, player_count: counts.get(s.id) ?? 0, total_buyin: totals.get(s.id) ?? 0 }))
}

// Unified list row: OPEN pinned on top + SETTLED by date descending. OPEN rows have winner = null.
export interface SessionRow {
  id: string
  date: string
  description: string | null
  exchange_rate: number
  status: 'OPEN' | 'SETTLED'
  player_count: number
  winner: { name: string; player_id: string } | null
}

export async function getSessionsList(): Promise<SessionRow[]> {
  const [settled, open] = await Promise.all([getSettledSessionsList(), getOpenSessions()])

  const openRows: SessionRow[] = open.map(s => ({
    id: s.id,
    date: s.date,
    description: s.description,
    exchange_rate: s.exchange_rate,
    status: 'OPEN',
    player_count: s.player_count,
    winner: null,
  }))

  const settledRows: SessionRow[] = settled.map(s => {
    const entries = s.session_entries
    const top = entries.length > 0 ? entries.reduce((best, e) => (e.chips > best.chips ? e : best), entries[0]) : null
    return {
      id: s.id,
      date: s.date,
      description: s.description,
      exchange_rate: s.exchange_rate,
      status: 'SETTLED',
      player_count: entries.length,
      winner: top && top.players ? { name: top.players.name, player_id: top.player_id } : null,
    }
  })

  return [...openRows, ...settledRows]
}

// ── session detail ─────────────────────────────────────────────
export interface SessionDetailEntry {
  id: string
  player_id: string
  chips: number
  final_chips: number | null
  total_buyin: number
  buy_ins: number[]
  players: { name: string } | null
}
export interface SessionDetail {
  id: string
  date: string
  description: string | null
  exchange_rate: number
  status: string
  session_entries: SessionDetailEntry[]
}

export async function getSessionStatus(id: string): Promise<string | null> {
  const { data } = await db.from('session').select('status').eq('id', id).is('deleted_at', null).single()
  return data?.status ?? null
}

export async function getSessionDetail(id: string): Promise<SessionDetail | null> {
  const { data: session } = await db
    .from('session')
    .select('id, date, description, exchange_rate, status')
    .eq('id', id)
    .single()
  if (!session) return null
  const [{ data: parts }, { data: buyins }, names] = await Promise.all([
    db.from('session_participant').select('id, player_id, final_chips').is('deleted_at', null).eq('session_id', id),
    db.from('buy_in').select('player_id, amount, created_at').is('deleted_at', null).eq('session_id', id).order('created_at', { ascending: true }),
    playerNameMap(),
  ])
  const flowByPlayer = groupByPlayer((buyins ?? []) as { player_id: string; amount: number }[])
  const entries: SessionDetailEntry[] = ((parts ?? []) as { id: string; player_id: string; final_chips: number | null }[]).map(p => {
    const flow = flowByPlayer.get(p.player_id) ?? []
    const total_buyin = buyinSum(flow)
    return {
      id: p.id,
      player_id: p.player_id,
      chips: netChips(p.final_chips, total_buyin),
      final_chips: p.final_chips,
      total_buyin,
      buy_ins: flow.map(b => b.amount),
      players: { name: names.get(p.player_id) ?? p.player_id },
    }
  })
  return { ...(session as Omit<SessionDetail, 'session_entries'>), session_entries: entries }
}

// For loading the edit form: returns each player's buy-in flow + final chips (net is derived on the client)
export interface EditBuyIn { amount: number; created_at: string }
export interface EditParticipant {
  player_id: string
  name: string
  final_chips: number | null
  buy_ins: EditBuyIn[]
}
export interface SessionForEdit {
  date: string
  exchange_rate: number
  description: string | null
  status: string
  participants: EditParticipant[]
}

export async function getSessionForEdit(id: string): Promise<SessionForEdit | null> {
  const { data: session } = await db
    .from('session')
    .select('date, exchange_rate, description, status')
    .eq('id', id)
    .single()
  if (!session) return null

  const [{ data: parts }, { data: buyins }, names] = await Promise.all([
    db.from('session_participant').select('player_id, final_chips').is('deleted_at', null).eq('session_id', id).order('created_at', { ascending: true }),
    db.from('buy_in').select('player_id, amount, created_at').is('deleted_at', null).eq('session_id', id).order('created_at', { ascending: true }),
    playerNameMap(),
  ])

  const flowByPlayer = groupByPlayer((buyins ?? []) as { player_id: string; amount: number; created_at: string }[])

  const participants: EditParticipant[] = ((parts ?? []) as { player_id: string; final_chips: number | null }[]).map(p => ({
    player_id: p.player_id,
    name: names.get(p.player_id) ?? p.player_id,
    final_chips: p.final_chips,
    buy_ins: (flowByPlayer.get(p.player_id) ?? []).map(b => ({ amount: b.amount, created_at: b.created_at })),
  }))

  return { ...(session as Omit<SessionForEdit, 'participants'>), participants }
}

// ── live session (OPEN) ────────────────────────────────────────
export interface LiveBuyIn {
  id: string
  player_id: string
  amount: number
  created_at: string
}
export interface LiveParticipant {
  player_id: string
  name: string
  total_buyin: number
  buy_ins: LiveBuyIn[]
}
export interface LiveSessionData {
  id: string
  date: string
  description: string | null
  exchange_rate: number
  buy_in_unit: number
  started_at: string | null
  status: string
  participants: LiveParticipant[]
}

export async function getLiveSession(id: string): Promise<LiveSessionData | null> {
  const { data: session } = await db
    .from('session')
    .select('id, date, description, exchange_rate, buy_in_unit, started_at, status')
    .eq('id', id)
    .single()
  if (!session) return null

  const [{ data: parts }, { data: buyins }, names] = await Promise.all([
    db.from('session_participant').select('player_id').is('deleted_at', null).eq('session_id', id).order('created_at', { ascending: true }),
    db.from('buy_in').select('id, player_id, amount, created_at').is('deleted_at', null).eq('session_id', id).order('created_at', { ascending: true }),
    playerNameMap(),
  ])

  const flowByPlayer = groupByPlayer((buyins ?? []) as LiveBuyIn[])

  const participants: LiveParticipant[] = ((parts ?? []) as { player_id: string }[]).map(p => {
    const flow = flowByPlayer.get(p.player_id) ?? []
    return {
      player_id: p.player_id,
      name: names.get(p.player_id) ?? p.player_id,
      total_buyin: buyinSum(flow),
      buy_ins: flow,
    }
  })

  return {
    ...(session as Omit<LiveSessionData, 'participants'>),
    buy_in_unit: session.buy_in_unit ?? BUY_IN_UNIT,
    participants,
  }
}

// ── player detail ──────────────────────────────────────────────
export interface PlayerHistorySession {
  id: string
  date: string
  description: string | null
  exchange_rate: number
  session_entries: ResultEntry[] // all players in the session, for POG computation
}
export interface PlayerHistoryEntry {
  session_id: string
  chips: number
  sessions: PlayerHistorySession
}
export interface PlayerDetail {
  id: string
  name: string
  entries: PlayerHistoryEntry[]
}

export async function getPlayerDetail(id: string): Promise<PlayerDetail | null> {
  const { data: player } = await db.from('player').select('id, name').eq('id', id).single()
  if (!player) return null

  // sessions this player took part in that are settled and not deleted
  const { data: myParts } = await db
    .from('session_participant')
    .select('session_id')
    .eq('player_id', id)
    .is('deleted_at', null)
  const mySessionIds = ((myParts ?? []) as { session_id: string }[]).map(p => p.session_id)
  if (mySessionIds.length === 0) return { id: player.id, name: player.name, entries: [] }

  const { data: sessions } = await db
    .from('session')
    .select('id, date, description, exchange_rate')
    .is('deleted_at', null)
    .eq('status', 'SETTLED')
    .in('id', mySessionIds)
  const sessionRows = (sessions ?? []) as { id: string; date: string; description: string | null; exchange_rate: number }[]
  const allBySession = await resultsBySession(sessionRows.map(s => s.id))

  const entries: PlayerHistoryEntry[] = sessionRows.map(s => {
    const all = allBySession.get(s.id) ?? []
    return {
      session_id: s.id,
      chips: all.find(e => e.player_id === id)?.chips ?? 0,
      sessions: { ...s, session_entries: all },
    }
  })
  return { id: player.id, name: player.name, entries }
}
