import ResponsiveActions from '@/components/ResponsiveActions'
import actionStyles from '@/components/ResponsiveActions.module.css'
import { Plus, Upload } from 'lucide-react'
import { Suspense } from 'react'
import Loading from './loading'
import { ResponsiveTable, ResponsiveHead, ResponsiveCell } from '@/components/ResponsiveTable'
import { TableHeader, TableRow, TableBody } from '@/components/ui/table'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import DeleteSessionButton from '@/components/DeleteSessionButton'
import PaginatedSessions from '@/components/PaginatedSessions'
import { Button } from '@/components/ui/button'
import { getGroup, getSessionsPage } from '@/lib/queries'
import {
  DEFAULT_SESSION_PAGE_SIZE,
  hasCanonicalSessionPageParams,
  MAX_SESSION_PAGE_SIZE,
  normalizeSessionPageParam,
  sessionPageHref,
} from '@/lib/session-pagination'

const columns = [
  { key: 'date', minWidth: 120, extraWidth: 16 },
  { key: 'description', minWidth: 140, wrap: true },
  { key: 'players', minWidth: 72 },
  { key: 'pog', minWidth: 90, wrap: true },
  { key: 'rate', minWidth: 60 },
  { key: 'actions', minWidth: 52, fixed: true },
]
const hideOrder = ['description', 'rate', 'pog']

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ groupId: string }>
  searchParams: Promise<{ page?: string | string[]; page_size?: string | string[] }>
}

async function SessionsPage({ params, query }: {
  params: PageProps['params']
  query: Awaited<PageProps['searchParams']>
}) {
  const { groupId } = await params
  const requestedPage = normalizeSessionPageParam(query.page, 1)
  const requestedPageSize = normalizeSessionPageParam(
    query.page_size,
    DEFAULT_SESSION_PAGE_SIZE,
    MAX_SESSION_PAGE_SIZE,
  )
  const [group, sessionsPage] = await Promise.all([
    getGroup(groupId),
    getSessionsPage(groupId, requestedPage, requestedPageSize),
  ])
  if (!group) notFound()
  const { sessions, page, page_size: pageSize, total, total_pages: totalPages } = sessionsPage
  const sessionsPath = `/groups/${groupId}/sessions`
  if (!hasCanonicalSessionPageParams(
    query.page ?? '1',
    query.page_size ?? String(DEFAULT_SESSION_PAGE_SIZE),
    page,
    pageSize,
  )) {
    redirect(sessionPageHref(sessionsPath, page, pageSize))
  }

  return (
    <>
      <ResponsiveActions className="mb-6">
        <span className={`${actionStyles.count} shrink-0 whitespace-nowrap text-muted-foreground tracking-normal`}>{total} SESSIONS</span>
        <div className={actionStyles.actions}>
          <Button asChild variant="outline" className={actionStyles.action}>
            <Link href={`/groups/${groupId}/sessions/import`} aria-label="Import session" title="Import session"><Upload aria-hidden="true" className="size-3.5" /><span>IMPORT</span></Link>
          </Button>
          <Button asChild className={actionStyles.action}>
            <Link href={`/groups/${groupId}/sessions/new`} aria-label="New session" title="New session"><Plus aria-hidden="true" className="size-3.5" /><span>NEW</span></Link>
          </Button>
        </div>
      </ResponsiveActions>
      <PaginatedSessions sessionsPath={sessionsPath} page={page} pageSize={pageSize} totalPages={totalPages}>
      <ResponsiveTable visibility="container" columns={columns} hideOrder={hideOrder} className="[&_th]:px-2 [&_td]:px-2">
        <TableHeader><TableRow className="h-16 border-b border-border text-muted-foreground text-xs tracking-normal">
          <ResponsiveHead column="date" className="text-left py-3 font-normal">DATE</ResponsiveHead><ResponsiveHead column="description" className="text-left py-3 font-normal whitespace-normal [overflow-wrap:anywhere]">DESCRIPTION</ResponsiveHead><ResponsiveHead column="players" className="text-right py-3 font-normal">PLAYERS</ResponsiveHead>
          <ResponsiveHead column="pog" className="text-right py-3 font-normal">POG</ResponsiveHead><ResponsiveHead column="rate" className="text-right py-3 font-normal">RATE</ResponsiveHead>
          <ResponsiveHead column="actions" className="text-right py-3 font-normal"></ResponsiveHead>
        </TableRow></TableHeader>
        <TableBody>
          {sessions.length === 0 && <TableRow><ResponsiveCell span className="py-12 text-center text-xs text-muted-foreground tracking-normal">NO SESSIONS YET</ResponsiveCell></TableRow>}
          {sessions.map(session => {
            const href = `/groups/${groupId}/sessions/${session.id}`
            const isOpen = session.status === 'OPEN'
            return <TableRow key={session.id} className={`border-b border-border transition-colors ${isOpen ? 'bg-live/5 hover:bg-live/10' : 'hover:bg-muted'}`}>
              <ResponsiveCell column="date" className="py-4 text-left"><Link href={href} className="block">
                <div className={`flex items-center gap-0.5 sm:gap-2 ${isOpen ? 'text-live' : ''}`}>
                  {isOpen && <><span aria-hidden="true" className="inline-block w-2 h-2 rounded-full bg-live motion-safe:animate-pulse shrink-0" /><span className="sr-only">Live session</span></>}<span data-measure-text>{session.date}</span>
                </div>
              </Link></ResponsiveCell>
              <ResponsiveCell column="description" className="py-4 text-left whitespace-normal [overflow-wrap:anywhere] text-muted-foreground"><Link href={href} className="block">{session.description || '—'}</Link></ResponsiveCell>
              <ResponsiveCell column="players" className="py-4 text-right text-muted-foreground"><Link href={href} className="block">{session.player_count}</Link></ResponsiveCell>
              <ResponsiveCell column="pog" className="py-4 text-right">{!isOpen && session.winners.length > 0
                ? <div className="flex flex-wrap justify-end gap-x-2 gap-y-1 whitespace-normal [overflow-wrap:anywhere]">{session.winners.map(winner => <Link key={winner.player_id} href={`/groups/${groupId}/players/${winner.player_id}`} className="min-w-0 text-muted-foreground hover:text-primary transition-colors">{winner.name}</Link>)}</div>
                : <span className="text-muted-foreground">—</span>}</ResponsiveCell>
              <ResponsiveCell column="rate" className="py-4 text-right text-muted-foreground"><Link href={href} className="block">{session.exchange_rate ? `${session.exchange_rate}:1` : '—'}</Link></ResponsiveCell>
              <ResponsiveCell column="actions" className="py-2 text-right"><DeleteSessionButton groupId={groupId} sessionId={session.id} /></ResponsiveCell>
            </TableRow>
          })}
        </TableBody>
      </ResponsiveTable>
      </PaginatedSessions>
    </>
  )
}

// Preserve the rendered page while client-side pagination loads new data.
export default async function Page(props: PageProps) {
  const query = await props.searchParams
  return <Suspense fallback={<Loading />}>
    <SessionsPage params={props.params} query={query} />
  </Suspense>
}
