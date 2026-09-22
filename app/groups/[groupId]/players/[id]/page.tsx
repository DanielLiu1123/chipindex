import { Suspense } from 'react'
import Loading from './loading'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import PlayerStatsChart from '@/components/PlayerStatsChart'
import PlayerSessionHistoryTable from '@/components/PlayerSessionHistoryTable'
import SessionPagination from '@/components/SessionPagination'
import { DEFAULT_SESSION_PAGE_SIZE, MAX_SESSION_PAGE_SIZE, normalizeSessionPageParam, hasCanonicalSessionPageParams, sessionPageHref } from '@/lib/session-pagination'
import { getPlayerDetail } from '@/lib/queries'
import { computePlayerHistory } from '@/lib/stats'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ groupId: string; id: string }>
  searchParams: Promise<{ page?: string | string[]; page_size?: string | string[] }>
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
  const { history, totalCny, totalChips, wins, pogCount } = computePlayerHistory(player)
  const totalPages = Math.max(1, Math.ceil(history.length / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const historyPath = `/groups/${groupId}/players/${id}`
  if (!hasCanonicalSessionPageParams(
    query.page ?? '1',
    query.page_size ?? String(DEFAULT_SESSION_PAGE_SIZE),
    page,
    pageSize,
  )) {
    redirect(sessionPageHref(historyPath, page, pageSize))
  }
  // Compute cumulative values over the full history before paging the table.
  // The chart and headline statistics continue to describe all sessions.
  const rows = [...history].reverse().slice((page - 1) * pageSize, page * pageSize)
  return <>
    <div className="mb-6"><Link href={`/groups/${groupId}`} className="text-muted-foreground text-xs hover:text-foreground tracking-normal">← LEADERBOARD</Link></div>
    <PlayerStatsChart groupId={groupId} id={id} initialName={player.name} data={history} totalCny={totalCny}
      totalChips={totalChips} sessions={history.length} wins={wins} pogCount={pogCount} />
    <p className="text-xs text-muted-foreground tracking-normal mb-4">SESSION HISTORY</p>
    <PlayerSessionHistoryTable groupId={groupId} rows={rows} />
    <SessionPagination sessionsPath={historyPath} page={page} pageSize={pageSize} totalPages={totalPages} />
  </>
}

// Reset the loading boundary for pagination as well as path changes.
export default async function Page(props: PageProps) {
  const query = await props.searchParams
  return <Suspense key={JSON.stringify([query.page, query.page_size])} fallback={<Loading />}>
    <PlayerDetailPage params={props.params} query={query} />
  </Suspense>
}
