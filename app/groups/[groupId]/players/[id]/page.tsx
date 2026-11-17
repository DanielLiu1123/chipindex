import { Suspense } from 'react'
import Loading from './loading'
import { notFound, redirect } from 'next/navigation'
import PlayerStatsChart from '@/components/PlayerStatsChart'
import PlayerSessionHistory from '@/components/PlayerSessionHistory'
import { DEFAULT_SESSION_PAGE_SIZE, MAX_SESSION_PAGE_SIZE, normalizeSessionPageParam, hasCanonicalSessionPageParams, sessionPageHref } from '@/lib/session-pagination'
import PlayerHistoryFilters from '@/components/PlayerHistoryFilters'
import { matchesPlayerAttendance, playerHistoryFilterParams, readPlayerHistoryFilters, scopePlayerHistory, type PlayerHistoryQuery } from '@/lib/player-history-filters'
import { getPlayerDetail, getPlayerTablemates } from '@/lib/queries'
import { computePlayerHistory } from '@/lib/stats'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ groupId: string; id: string }>
  searchParams: Promise<PlayerHistoryQuery>
}

async function PlayerDetailPage({ params, query }: {
  params: PageProps['params']
  query: Awaited<PageProps['searchParams']>
}) {
  const { groupId, id } = await params
  const requestedPage = normalizeSessionPageParam(query.page, 1)
  const pageSize = normalizeSessionPageParam(query.page_size, DEFAULT_SESSION_PAGE_SIZE, MAX_SESSION_PAGE_SIZE)
  const player = await getPlayerDetail(groupId, id)
  if (!player) notFound()
  const players = await getPlayerTablemates(player)
  const { date, attendance } = readPlayerHistoryFilters(query, players.map(candidate => candidate.id))
  const scoped = scopePlayerHistory(player.entries, date)
  const lineups = scoped.map(entry => entry.sessions.session_entries.map(result => result.player_id))
  const rules = Object.entries(attendance)
  const entries = scoped.filter((_, index) => matchesPlayerAttendance(lineups[index], rules))
  const { history, totalCny, totalChips, wins, pogCount } = computePlayerHistory({ ...player, entries })
  const filterParams = playerHistoryFilterParams(date, attendance)
  const filtered = filterParams.length > 0
  const ties = history.filter(point => point.chips === 0).length
  const totalPages = Math.max(1, Math.ceil(history.length / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const historyPath = `/groups/${groupId}/players/${id}`
  if (!hasCanonicalSessionPageParams(
    query.page ?? '1',
    query.page_size ?? String(DEFAULT_SESSION_PAGE_SIZE),
    page,
    pageSize,
  )) {
    redirect(sessionPageHref(historyPath, page, pageSize, filterParams))
  }
  // Build the cumulative series over all matching sessions before paging the table.
  const rows = [...history].reverse().slice((page - 1) * pageSize, page * pageSize)
  return <>
    <PlayerStatsChart groupId={groupId} id={id} initialName={player.name} data={history} totalCny={totalCny}
      totalChips={totalChips} sessions={history.length} wins={wins} pogCount={pogCount}
      analysis={filtered ? { losses: history.length - wins - ties, ties } : undefined}
      filters={<PlayerHistoryFilters path={historyPath} pageSize={pageSize} date={date} attendance={attendance}
        players={players} lineups={lineups} />} />
    <p className="text-xs text-muted-foreground tracking-normal mb-4">SESSION HISTORY</p>
    <PlayerSessionHistory groupId={groupId} rows={rows} sessionsPath={historyPath} page={page} pageSize={pageSize} totalPages={totalPages}
      query={filterParams} emptyLabel={filtered ? 'NO MATCHING SESSIONS' : undefined} />
  </>
}

// Keep the revealed profile mounted during pagination transitions.
export default async function Page(props: PageProps) {
  const query = await props.searchParams
  return <Suspense fallback={<Loading />}>
    <PlayerDetailPage params={props.params} query={query} />
  </Suspense>
}
