import { cache } from 'react'
import { db } from './db'
import { BUY_IN_UNIT } from './synth'
import { buyinSum, netChips } from './settlement'
import {
  buildResultsBySession,
  type BuyInResultRow,
  type ParticipantResultRow,
  type ResultEntry,
} from './session-results'
import type { Group, GroupPlayer, Player } from '@/types'

export type { ResultEntry } from './session-results'

// ── Central place for all table reads. Net result chips come from
//    lib/settlement.ts, computed over non-deleted rows (see resultsBySession).
//    Session-level deleted_at/status is filtered on the session table first.

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
const RESULT_PAGE_SIZE = 1000

function throwIfQueryError(error: unknown): void {
  if (error) throw error
}

async function fetchAllResultRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error?: unknown }>,
): Promise<T[]> {
  const rows: T[] = []

  while (true) {
    const from = rows.length
    const { data, error } = await fetchPage(from, from + RESULT_PAGE_SIZE - 1)
    if (error) throw error

    const page = data ?? []
    rows.push(...page)
    if (page.length < RESULT_PAGE_SIZE) return rows
  }
}

async function resultsBySession(sessionIds: string[]): Promise<Map<string, ResultEntry[]>> {
  if (sessionIds.length === 0) return new Map()
  const [participantRows, buyInRows] = await Promise.all([
    fetchAllResultRows<ParticipantResultRow>((from, to) => db
      .from('session_participant')
      .select('session_id, player_id, final_chips')
      .is('deleted_at', null)
      .in('session_id', sessionIds)
      .order('id', { ascending: true })
      .range(from, to)),
    fetchAllResultRows<BuyInResultRow>((from, to) => db
      .from('buy_in')
      .select('session_id, player_id, amount')
      .is('deleted_at', null)
      .in('session_id', sessionIds)
      .order('id', { ascending: true })
      .range(from, to)),
  ])
  return buildResultsBySession(participantRows, buyInRows)
}

// cache() dedupes the player fetch within a single request, so pages that
// need both the player list and a name map hit the table once.
export const getGroups = cache(async (): Promise<Group[]> => {
  const { data, error } = await db
    .from('group')
    .select('id, name, created_at, updated_at, deleted_at')
    .is('deleted_at', null)
    .order('name')
  if (error) throw error
  return (data ?? []) as Group[]
})

export const getGroup = cache(async (groupId: string): Promise<Group | null> => {
  const { data, error } = await db
    .from('group')
    .select('id, name, created_at, updated_at, deleted_at')
    .eq('id', groupId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data as Group | null
})

export const getGroupPlayers = cache(async (groupId: string): Promise<Array<{ player: Player; group_player: GroupPlayer }>> => {
  const { data: groupPlayers, error } = await db
    .from('group_player')
    .select('id, group_id, player_id, created_at, updated_at, deleted_at')
    .eq('group_id', groupId)
    .is('deleted_at', null)
  if (error) throw error
  const rows = (groupPlayers ?? []) as GroupPlayer[]
  if (rows.length === 0) return []

  const { data: players, error: playerError } = await db
    .from('player')
    .select('id, name, created_at, updated_at, deleted_at')
    .in('id', rows.map(row => row.player_id))
    .is('deleted_at', null)
  if (playerError) throw playerError
  const playerById = new Map(((players ?? []) as Player[]).map(player => [player.id, player]))
  return rows
    .flatMap(row => {
      const player = playerById.get(row.player_id)
      return player ? [{ player, group_player: row }] : []
    })
    .sort((a, b) => a.group_player.created_at.localeCompare(b.group_player.created_at)
      || a.group_player.id.localeCompare(b.group_player.id))
})

export const getPlayers = cache(async (groupId: string): Promise<Player[]> => {
  return (await getGroupPlayers(groupId)).map(row => row.player)
})

export async function getLeaderboardPlayers(groupId: string): Promise<Player[]> {
  const [activeRows, sessions] = await Promise.all([
    getGroupPlayers(groupId),
    db.from('session').select('id').eq('group_id', groupId).eq('status', 'SETTLED').is('deleted_at', null),
  ])
  throwIfQueryError(sessions.error)
  const playerById = new Map(activeRows.map(row => [row.player.id, row.player]))
  const sessionIds = ((sessions.data ?? []) as { id: string }[]).map(row => row.id)
  if (sessionIds.length === 0) return [...playerById.values()]

  const { data: participants, error: participantError } = await db
    .from('session_participant')
    .select('player_id')
    .in('session_id', sessionIds)
    .is('deleted_at', null)
  if (participantError) throw participantError
  const historicalIds = [...new Set(((participants ?? []) as { player_id: string }[]).map(row => row.player_id))]
    .filter(id => !playerById.has(id))
  if (historicalIds.length > 0) {
    const { data: historicalPlayers, error: playerError } = await db
      .from('player')
      .select('id, name, created_at, updated_at, deleted_at')
      .in('id', historicalIds)
      .is('deleted_at', null)
    if (playerError) throw playerError
    for (const player of (historicalPlayers ?? []) as Player[]) playerById.set(player.id, player)
  }
  return [...playerById.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

export async function getAllPlayers(): Promise<Player[]> {
  const { data, error } = await db
    .from('player')
    .select('id, name, created_at, updated_at, deleted_at')
    .is('deleted_at', null)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as Player[]
}

async function playerNameMap(): Promise<Map<string, string>> {
  const { data, error } = await db.from('player').select('id, name').is('deleted_at', null)
  if (error) throw error
  return new Map(((data ?? []) as Array<Pick<Player, 'id' | 'name'>>).map(p => [p.id, p.name]))
}

export async function getLeaderboardSessions(groupId: string): Promise<LeaderboardSessionRow[]> {
  const { data: sessions, error } = await db
    .from('session')
    .select('id, date, exchange_rate')
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .eq('status', 'SETTLED')
    .order('date', { ascending: true })
  throwIfQueryError(error)
  const rows = (sessions ?? []) as { id: string; date: string; exchange_rate: number }[]
  const byId = await resultsBySession(rows.map(s => s.id))
  return rows.map(s => ({ ...s, session_entries: byId.get(s.id) ?? [] }))
}

// ── sessions list ──────────────────────────────────────────────
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

interface SessionListSource {
  id: string
  date: string
  description: string | null
  exchange_rate: number
  status: 'OPEN' | 'SETTLED'
  started_at: string | null
}

export async function getSessionsList(groupId: string): Promise<SessionRow[]> {
  const { data: sessions, error } = await db
    .from('session')
    .select('id, date, description, exchange_rate, status, started_at')
    .eq('group_id', groupId)
    .is('deleted_at', null)
  throwIfQueryError(error)
  const rows = (sessions ?? []) as SessionListSource[]
  if (rows.length === 0) return []
  const [byId, names] = await Promise.all([resultsBySession(rows.map(s => s.id)), playerNameMap()])

  const toRow = (s: SessionListSource): SessionRow => {
    const entries = byId.get(s.id) ?? []
    const top = entries.length > 0 ? entries.reduce((best, e) => (e.chips > best.chips ? e : best), entries[0]) : null
    return {
      id: s.id,
      date: s.date,
      description: s.description,
      exchange_rate: s.exchange_rate,
      status: s.status,
      player_count: entries.length,
      winner: s.status === 'SETTLED' && top ? { name: names.get(top.player_id) ?? top.player_id, player_id: top.player_id } : null,
    }
  }

  const open = rows
    .filter(s => s.status === 'OPEN')
    .sort((a, b) => (b.started_at ?? '').localeCompare(a.started_at ?? ''))
  const settled = rows
    .filter(s => s.status === 'SETTLED')
    .sort((a, b) => b.date.localeCompare(a.date))

  return [...open.map(toRow), ...settled.map(toRow)]
}

// ── session detail ─────────────────────────────────────────────
export interface SessionDetailEntry {
  id: string
  player_id: string
  chips: number
  final_chips: number | null
  total_buyin: number
  buy_ins: { amount: number; created_at: string }[]
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

export async function getSessionStatus(groupId: string, id: string): Promise<string | null> {
  const { data, error } = await db.from('session').select('status').eq('group_id', groupId).eq('id', id).is('deleted_at', null).maybeSingle()
  throwIfQueryError(error)
  return data?.status ?? null
}

export async function getSessionDetail(groupId: string, id: string): Promise<SessionDetail | null> {
  const [sessionResult, partsResult, buyinsResult, names] = await Promise.all([
    db.from('session').select('id, date, description, exchange_rate, status').eq('group_id', groupId).eq('id', id).is('deleted_at', null).maybeSingle(),
    db.from('session_participant').select('id, player_id, final_chips').is('deleted_at', null).eq('session_id', id),
    db.from('buy_in').select('player_id, amount, created_at').is('deleted_at', null).eq('session_id', id).order('created_at', { ascending: true }),
    playerNameMap(),
  ])
  throwIfQueryError(sessionResult.error)
  throwIfQueryError(partsResult.error)
  throwIfQueryError(buyinsResult.error)
  const { data: session } = sessionResult
  const { data: parts } = partsResult
  const { data: buyins } = buyinsResult
  if (!session) return null
  const flowByPlayer = groupByPlayer((buyins ?? []) as { player_id: string; amount: number; created_at: string }[])
  const entries: SessionDetailEntry[] = ((parts ?? []) as { id: string; player_id: string; final_chips: number | null }[]).map(p => {
    const flow = flowByPlayer.get(p.player_id) ?? []
    const total_buyin = buyinSum(flow)
    return {
      id: p.id,
      player_id: p.player_id,
      chips: netChips(p.final_chips, total_buyin),
      final_chips: p.final_chips,
      total_buyin,
      buy_ins: flow.map(b => ({ amount: b.amount, created_at: b.created_at })),
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

export async function getSessionForEdit(groupId: string, id: string): Promise<SessionForEdit | null> {
  const [sessionResult, partsResult, buyinsResult, names] = await Promise.all([
    db.from('session').select('date, exchange_rate, description, status').eq('group_id', groupId).eq('id', id).is('deleted_at', null).maybeSingle(),
    db.from('session_participant').select('player_id, final_chips').is('deleted_at', null).eq('session_id', id).order('created_at', { ascending: true }),
    db.from('buy_in').select('player_id, amount, created_at').is('deleted_at', null).eq('session_id', id).order('created_at', { ascending: true }),
    playerNameMap(),
  ])
  throwIfQueryError(sessionResult.error)
  throwIfQueryError(partsResult.error)
  throwIfQueryError(buyinsResult.error)
  const { data: session } = sessionResult
  const { data: parts } = partsResult
  const { data: buyins } = buyinsResult
  if (!session) return null

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

export async function getLiveSession(groupId: string, id: string): Promise<LiveSessionData | null> {
  const [sessionResult, partsResult, buyinsResult, names] = await Promise.all([
    db.from('session').select('id, date, description, exchange_rate, buy_in_unit, started_at, status').eq('group_id', groupId).eq('id', id).is('deleted_at', null).maybeSingle(),
    db.from('session_participant').select('player_id').is('deleted_at', null).eq('session_id', id).order('created_at', { ascending: true }),
    db.from('buy_in').select('id, player_id, amount, created_at').is('deleted_at', null).eq('session_id', id).order('created_at', { ascending: true }),
    playerNameMap(),
  ])
  throwIfQueryError(sessionResult.error)
  throwIfQueryError(partsResult.error)
  throwIfQueryError(buyinsResult.error)
  const { data: session } = sessionResult
  const { data: parts } = partsResult
  const { data: buyins } = buyinsResult
  if (!session) return null

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
  started_at: string | null
  session_entries: ResultEntry[] // all players in the session, for POG computation
}
export interface PlayerHistoryEntry {
  session_id: string
  chips: number
  final_chips: number | null
  total_buyin: number
  buy_in_count: number
  sessions: PlayerHistorySession
}
export interface PlayerDetail {
  id: string
  name: string
  group_player: GroupPlayer | null
  entries: PlayerHistoryEntry[]
}

export async function getPlayerDetail(groupId: string, id: string): Promise<PlayerDetail | null> {
  // sessions this player took part in that are settled and not deleted
  const [playerResult, groupPlayerResult, groupSessionsResult] = await Promise.all([
    db.from('player').select('id, name').eq('id', id).is('deleted_at', null).maybeSingle(),
    db.from('group_player').select('id, group_id, player_id, created_at, updated_at, deleted_at').eq('group_id', groupId).eq('player_id', id).is('deleted_at', null).maybeSingle(),
    db.from('session').select('id').eq('group_id', groupId).eq('status', 'SETTLED').is('deleted_at', null),
  ])
  throwIfQueryError(playerResult.error)
  throwIfQueryError(groupPlayerResult.error)
  throwIfQueryError(groupSessionsResult.error)
  const { data: player } = playerResult
  const { data: groupPlayer } = groupPlayerResult
  const { data: groupSessions } = groupSessionsResult
  if (!player) return null
  const groupSessionIds = ((groupSessions ?? []) as { id: string }[]).map(session => session.id)
  let mySessionIds: string[] = []
  if (groupSessionIds.length > 0) {
    const { data: myParts, error } = await db
      .from('session_participant')
      .select('session_id')
      .eq('player_id', id)
      .in('session_id', groupSessionIds)
      .is('deleted_at', null)
    throwIfQueryError(error)
    mySessionIds = ((myParts ?? []) as { session_id: string }[]).map(p => p.session_id)
  }
  if (!groupPlayer && mySessionIds.length === 0) return null
  const group_player = groupPlayer ? groupPlayer as GroupPlayer : null
  if (mySessionIds.length === 0) return { id: player.id, name: player.name, group_player, entries: [] }

  const { data: sessions, error } = await db
    .from('session')
    .select('id, date, description, exchange_rate, started_at')
    .is('deleted_at', null)
    .eq('status', 'SETTLED')
    .eq('group_id', groupId)
    .in('id', mySessionIds)
  throwIfQueryError(error)
  const sessionRows = (sessions ?? []) as { id: string; date: string; description: string | null; exchange_rate: number; started_at: string | null }[]
  const allBySession = await resultsBySession(sessionRows.map(s => s.id))

  const entries: PlayerHistoryEntry[] = sessionRows.map(s => {
    const all = allBySession.get(s.id) ?? []
    const mine = all.find(e => e.player_id === id)
    return {
      session_id: s.id,
      chips: mine?.chips ?? 0,
      final_chips: mine?.final_chips ?? null,
      total_buyin: mine?.total_buyin ?? 0,
      buy_in_count: mine?.buy_in_count ?? 0,
      sessions: { ...s, session_entries: all },
    }
  })
  return { id: player.id, name: player.name, group_player, entries }
}
