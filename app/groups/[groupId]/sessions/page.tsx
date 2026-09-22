import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import DeleteSessionButton from '@/components/DeleteSessionButton'
import SessionPagination from '@/components/SessionPagination'
import { getGroup, getSessionsPage } from '@/lib/queries'
import {
  DEFAULT_SESSION_PAGE_SIZE,
  hasCanonicalSessionPageParams,
  MAX_SESSION_PAGE_SIZE,
  normalizeSessionPageParam,
  sessionPageHref,
} from '@/lib/session-pagination'

export const dynamic = 'force-dynamic'

export default async function SessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>
  searchParams: Promise<{ page?: string | string[]; page_size?: string | string[] }>
}) {
  const { groupId } = await params
  const query = await searchParams
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
  if (!hasCanonicalSessionPageParams(query.page, query.page_size, page, pageSize)) {
    redirect(sessionPageHref(sessionsPath, page, pageSize))
  }

  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <span className="text-xs text-muted-foreground tracking-normal">{total} SESSIONS</span>
        <div className="flex items-center gap-4">
          <Link href={`/groups/${groupId}/sessions/new`} className="text-xs text-primary tracking-normal hover:underline">+ NEW SESSION</Link>
          <Link href={`/groups/${groupId}/sessions/import`} className="text-xs text-primary tracking-normal hover:underline">IMPORT SESSION</Link>
        </div>
      </div>
      <Table className="w-full text-sm">
        <TableHeader><TableRow className="border-b border-border text-muted-foreground text-xs tracking-normal">
          <TableHead className="text-left py-3 font-normal">DATE</TableHead><TableHead className="text-right py-3 font-normal">PLAYERS</TableHead>
          <TableHead className="text-right py-3 font-normal">POG</TableHead><TableHead className="text-right py-3 font-normal">RATE</TableHead>
          <TableHead className="text-right py-3 font-normal"></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {sessions.length === 0 && <TableRow><TableCell colSpan={5} className="py-12 text-center text-xs text-muted-foreground tracking-normal">NO SESSIONS YET</TableCell></TableRow>}
          {sessions.map(session => {
            const href = `/groups/${groupId}/sessions/${session.id}`
            const isOpen = session.status === 'OPEN'
            return <TableRow key={session.id} className={`border-b border-border transition-colors ${isOpen ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted'}`}>
              <TableCell className="py-4"><Link href={href} className="block">
                <div className={`flex items-center gap-2 ${isOpen ? 'text-primary' : ''}`}>
                  {isOpen && <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />}{session.date}
                </div>
                {session.description && <div className="text-xs text-muted-foreground mt-0.5">{session.description}</div>}
              </Link></TableCell>
              <TableCell className="py-4 text-right text-muted-foreground"><Link href={href} className="block">{session.player_count}</Link></TableCell>
              <TableCell className="py-4 text-right">{!isOpen && session.winners.length > 0
                ? <div className="flex flex-wrap justify-end gap-x-2 gap-y-1">{session.winners.map(winner => <Link key={winner.player_id} href={`/groups/${groupId}/players/${winner.player_id}`} className="text-muted-foreground hover:text-primary transition-colors">{winner.name}</Link>)}</div>
                : <span className="text-muted-foreground">—</span>}</TableCell>
              <TableCell className="py-4 text-right text-muted-foreground"><Link href={href} className="block">{session.exchange_rate ? `${session.exchange_rate}:1` : '—'}</Link></TableCell>
              <TableCell className="py-4 text-right"><DeleteSessionButton groupId={groupId} sessionId={session.id} /></TableCell>
            </TableRow>
          })}
        </TableBody>
      </Table>
      <SessionPagination sessionsPath={sessionsPath} page={page} pageSize={pageSize} totalPages={totalPages} />
    </>
  )
}
