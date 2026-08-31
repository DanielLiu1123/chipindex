import { cache } from 'react'
import { db } from './db'
import { BUY_IN_UNIT } from './synth'
import { buyinSum, netChips } from './settlement'
import { MAX_SESSION_PAGE_SIZE } from './session-pagination'
import {
  buildResultsBySession,
  type BuyInResultRow,
  type ParticipantResultRow,
  type ResultEntry,
} from './session-results'
import type { Group, GroupPlayer, Player } from '@/lib/domain-types'

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

function exchangeRate(value: number | null): number {
  return value ?? 40
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
  return data ?? []
})

export const getGroup = cache(async (groupId: string): Promise<Group | null> => {
  const { data, error } = await db
    .from('group')
    .select('id, name, created_at, updated_at, deleted_at')
    .eq('id', groupId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error) throw error
  return data
})

export const getGroupPlayers = cache(async (groupId: string): Promise<Array<{ player: Player; group_player: GroupPlayer }>> => {
  const { data: groupPlayers, error } = await db
    .from('group_player')
    .select('id, group_id, player_id, created_at, updated_at, deleted_at')
    .eq('group_id', groupId)
    .is('deleted_at', null)
  if (error) throw error
  const rows = groupPlayers ?? []
  if (rows.length === 0) return []

  const { data: players, error: playerError } = await db
    .from('player')
    .select('id, name, created_at, updated_at, deleted_at')
    .in('id', rows.map(row => row.player_id))
    .is('deleted_at', null)
  if (playerError) throw playerError
  const playerById = new Map((players ?? []).map(player => [player.id, player]))
  return rows
    .flatMap(row => {
      const player = playerById.get(row.player_id)
      return player ? [{ player, group_player: row }] : []
    })
    .sort((a, b) => a.group_player.created_at.localeCompare(b.group_player.created_at)
      || a.player.id.localeCompare(b.player.id))
})

export const getPlayers = cache(async (groupId: string): Promise<Player[]> => {
  return (await getGroupPlayers(groupId)).map(row => row.player)
})

export async function getAllPlayers(): Promise<Player[]> {
  const { data, error } = await db
    .from('player')
    .select('id, name, created_at, updated_at, deleted_at')
    .is('deleted_at', null)
    .order('created_at')
    .order('id')
  if (error) throw error
  return data ?? []
}

async function playerNameMap(playerIds?: string[]): Promise<Map<string, string>> {
  const ids = playerIds ? [...new Set(playerIds)] : undefined
  if (ids?.length === 0) return new Map()
  let query = db.from('player').select('id, name').is('deleted_at', null)
  if (ids) query = query.in('id', ids)
  const { data, error } = await query
  if (error) throw error
  return new Map((data ?? []).map(player => [player.id, player.name]))
}

export interface LeaderboardData {
  players: Player[]
  sessions: LeaderboardSessionRow[]
}

export async function getLeaderboardData(groupId: string): Promise<LeaderboardData> {
  const [activeRows, sessionResult] = await Promise.all([
    getGroupPlayers(groupId),
    db.from('session')
      .select('id, date, exchange_rate')
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .eq('status', 'SETTLED')
      .order('date', { ascending: true }),
  ])
  throwIfQueryError(sessionResult.error)
  const sessionRows = (sessionResult.data ?? []).map(session => ({
    ...session,
    exchange_rate: exchangeRate(session.exchange_rate),
  }))
  const bySession = await resultsBySession(sessionRows.map(session => session.id))
  const playerById = new Map(activeRows.map(row => [row.player.id, row.player]))
  const historicalIds = [...new Set(
    [...bySession.values()].flatMap(entries => entries.map(entry => entry.player_id)),
  )].filter(playerId => !playerById.has(playerId))

  if (historicalIds.length > 0) {
    const { data, error } = await db
      .from('player')
      .select('id, name, created_at, updated_at, deleted_at')
      .in('id', historicalIds)
      .is('deleted_at', null)
    throwIfQueryError(error)
    for (const player of data ?? []) playerById.set(player.id, player)
  }

  return {
    players: [...playerById.values()]
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)),
    sessions: sessionRows.map(session => ({
      ...session,
      session_entries: bySession.get(session.id) ?? [],
    })),
  }
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

export interface SessionsPage {
  sessions: SessionRow[]
  page: number
  page_size: number
  total: number
  total_pages: number
}

const SESSION_LIST_COLUMNS = 'id, date, description, exchange_rate, status, started_at'

async function buildSessionRows(rows: SessionListSource[]): Promise<SessionRow[]> {
  if (rows.length === 0) return []
  const byId = await resultsBySession(rows.map(session => session.id))
  const names = await playerNameMap([...byId.values()].flatMap(entries => entries.map(entry => entry.player_id)))

  return rows.map(session => {
    const entries = byId.get(session.id) ?? []
    const top = entries.length > 0
      ? entries.reduce((best, entry) => (
          entry.chips > best.chips
          || (entry.chips === best.chips && entry.player_id.localeCompare(best.player_id) < 0)
            ? entry
            : best
        ), entries[0])
      : null
    return {
      id: session.id,
      date: session.date,
      description: session.description,
      exchange_rate: session.exchange_rate,
      status: session.status,
      player_count: entries.length,
      winner: session.status === 'SETTLED' && top
        ? { name: names.get(top.player_id) ?? top.player_id, player_id: top.player_id }
        : null,
    }
  })
}

async function countSessionsByStatus(groupId: string, status: SessionListSource['status']): Promise<number> {
  const { count, error } = await db
    .from('session')
    .select('id', { count: 'exact', head: true })
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .eq('status', status)
  throwIfQueryError(error)
  return count ?? 0
}

async function fetchSessionSlice(
  groupId: string,
  status: SessionListSource['status'],
  from: number,
  limit: number,
): Promise<SessionListSource[]> {
  if (limit <= 0) return []
  const query = db
    .from('session')
    .select(SESSION_LIST_COLUMNS)
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .eq('status', status)

  const { data, error } = status === 'OPEN'
    ? await query
      .order('started_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + limit - 1)
    : await query
      .order('date', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + limit - 1)
  throwIfQueryError(error)
  return (data ?? []).map(session => ({
    ...session,
    exchange_rate: exchangeRate(session.exchange_rate),
    status,
  }))
}

export async function getSessionsPage(groupId: string, requestedPage = 1, requestedPageSize = 10): Promise<SessionsPage> {
  const pageSize = Number.isSafeInteger(requestedPageSize) && requestedPageSize > 0
    ? Math.min(requestedPageSize, MAX_SESSION_PAGE_SIZE)
    : 10
  const validRequestedPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const [openCount, settledCount] = await Promise.all([
    countSessionsByStatus(groupId, 'OPEN'),
    countSessionsByStatus(groupId, 'SETTLED'),
  ])
  const total = openCount + settledCount
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(validRequestedPage, totalPages)
  const from = (page - 1) * pageSize
  const openLimit = Math.max(0, Math.min(pageSize, openCount - from))
  const settledFrom = Math.max(0, from - openCount)
  const settledLimit = Math.max(0, Math.min(pageSize - openLimit, settledCount - settledFrom))
  const [openRows, settledRows] = await Promise.all([
    fetchSessionSlice(groupId, 'OPEN', from, openLimit),
    fetchSessionSlice(groupId, 'SETTLED', settledFrom, settledLimit),
  ])

  return {
    sessions: await buildSessionRows([...openRows, ...settledRows]),
    page,
    page_size: pageSize,
    total,
    total_pages: totalPages,
  }
}

// ── session detail ─────────────────────────────────────────────
export interface SessionDetailEntry {
  id: string
  player_id: string
  chips: number
  final_chips: number | null
  total_buyin: number
  buy_ins: { amount: number; created_at: string }[]
  settled_at: string | null
  players: { name: string } | null
}
export interface SessionDetail {
  id: string
  date: string
  description: string | null
  exchange_rate: number
  status: string
  started_at: string | null
  ended_at: string | null
  session_entries: SessionDetailEntry[]
}

type SessionStatus = 'OPEN' | 'SETTLED'

function sessionStatus(value: string): SessionStatus {
  if (value === 'OPEN' || value === 'SETTLED') return value
  throw new Error(`Unknown session status: ${value}`)
}

interface SessionAggregateSource {
  session: {
    id: string
    date: string
    description: string | null
    exchange_rate: number
    buy_in_unit: number | null
    started_at: string | null
    ended_at: string | null
    status: SessionStatus
  }
  participants: Array<{ id: string; player_id: string; final_chips: number | null; settled_at: string | null; created_at: string }>
  buy_ins: LiveBuyIn[]
  names: Map<string, string>
}

async function loadSessionAggregate(groupId: string, id: string): Promise<SessionAggregateSource | null> {
  const sessionResult = await db
    .from('session')
    .select('id, date, description, exchange_rate, buy_in_unit, started_at, ended_at, status')
    .eq('group_id', groupId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  throwIfQueryError(sessionResult.error)
  if (!sessionResult.data) return null

  const [partsResult, buyinsResult] = await Promise.all([
    db.from('session_participant')
      .select('id, player_id, final_chips, settled_at, created_at')
      .is('deleted_at', null)
      .eq('session_id', id)
      .order('created_at', { ascending: true }),
    db.from('buy_in')
      .select('id, player_id, amount, created_at')
      .is('deleted_at', null)
      .eq('session_id', id)
      .order('created_at', { ascending: true }),
  ])
  throwIfQueryError(partsResult.error)
  throwIfQueryError(buyinsResult.error)
  const participants = partsResult.data ?? []
  const buy_ins = buyinsResult.data ?? []
  const names = await playerNameMap(participants.map(participant => participant.player_id))
  return {
    session: {
      ...sessionResult.data,
      exchange_rate: exchangeRate(sessionResult.data.exchange_rate),
      status: sessionStatus(sessionResult.data.status),
    },
    participants,
    buy_ins,
    names,
  }
}

function sessionDetailFromAggregate(source: SessionAggregateSource): SessionDetail {
  const flowByPlayer = groupByPlayer(source.buy_ins)
  const session_entries = source.participants.map(participant => {
    const flow = flowByPlayer.get(participant.player_id) ?? []
    const total_buyin = buyinSum(flow)
    return {
      id: participant.id,
      player_id: participant.player_id,
      chips: netChips(participant.final_chips, total_buyin),
      final_chips: participant.final_chips,
      total_buyin,
      buy_ins: flow.map(buyIn => ({ amount: buyIn.amount, created_at: buyIn.created_at })),
      settled_at: participant.settled_at,
      players: { name: source.names.get(participant.player_id) ?? participant.player_id },
    }
  }).sort((a, b) => b.chips - a.chips || a.player_id.localeCompare(b.player_id))
  const { buy_in_unit: _buyInUnit, ...session } = source.session
  return { ...session, session_entries }
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
  ended_at: string | null
  participants: EditParticipant[]
}

export async function getSessionForEdit(groupId: string, id: string): Promise<SessionForEdit | null> {
  const source = await loadSessionAggregate(groupId, id)
  if (!source) return null
  const flowByPlayer = groupByPlayer(source.buy_ins)
  const participants: EditParticipant[] = source.participants.map(participant => ({
    player_id: participant.player_id,
    name: source.names.get(participant.player_id) ?? participant.player_id,
    final_chips: participant.final_chips,
    buy_ins: (flowByPlayer.get(participant.player_id) ?? []).map(buyIn => ({ amount: buyIn.amount, created_at: buyIn.created_at })),
  }))
  const { id: _id, buy_in_unit: _buyInUnit, started_at: _startedAt, ...session } = source.session
  return { ...session, participants }
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
  final_chips: number | null
  settled_at: string | null
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

function liveSessionFromAggregate(source: SessionAggregateSource): LiveSessionData {
  const flowByPlayer = groupByPlayer(source.buy_ins)
  const participants = [...source.participants].sort((a, b) =>
    a.created_at.localeCompare(b.created_at)
    || a.player_id.localeCompare(b.player_id))
  return {
    ...source.session,
    buy_in_unit: source.session.buy_in_unit ?? BUY_IN_UNIT,
    participants: participants.map(participant => {
      const buy_ins = flowByPlayer.get(participant.player_id) ?? []
      return {
        player_id: participant.player_id,
        name: source.names.get(participant.player_id) ?? participant.player_id,
        total_buyin: buyinSum(buy_ins),
        buy_ins,
        final_chips: participant.final_chips,
        settled_at: participant.settled_at,
      }
    }),
  }
}

export type SessionPageData =
  | { status: 'OPEN'; session: LiveSessionData }
  | { status: 'SETTLED'; session: SessionDetail }

export async function getSessionPageData(groupId: string, id: string): Promise<SessionPageData | null> {
  const source = await loadSessionAggregate(groupId, id)
  if (!source) return null
  return source.session.status === 'OPEN'
    ? { status: 'OPEN', session: liveSessionFromAggregate(source) }
    : { status: 'SETTLED', session: sessionDetailFromAggregate(source) }
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
