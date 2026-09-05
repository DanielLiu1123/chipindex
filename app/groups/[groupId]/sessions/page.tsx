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
        <span className="text-xs text-muted tracking-widest">{total} SESSIONS</span>
        <div className="flex items-center gap-4">
          <Link href={`/groups/${groupId}/sessions/new`} className="text-xs text-accent tracking-widest hover:underline">+ NEW SESSION</Link>
          <Link href={`/groups/${groupId}/sessions/import`} className="text-xs text-accent tracking-widest hover:underline">IMPORT SESSION</Link>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-muted text-xs tracking-widest">
          <th className="text-left py-3 font-normal">DATE</th><th className="text-right py-3 font-normal">PLAYERS</th>
          <th className="text-right py-3 font-normal">POG</th><th className="text-right py-3 font-normal">RATE</th>
          <th className="text-right py-3 font-normal"></th>
        </tr></thead>
        <tbody>
          {sessions.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-xs text-muted tracking-widest">NO SESSIONS YET</td></tr>}
          {sessions.map(session => {
            const href = `/groups/${groupId}/sessions/${session.id}`
            const isOpen = session.status === 'OPEN'
            return <tr key={session.id} className={`border-b border-border transition-colors ${isOpen ? 'bg-accent/5 hover:bg-accent/10' : 'hover:bg-surface'}`}>
              <td className="py-4"><Link href={href} className="block">
                <div className={`flex items-center gap-2 ${isOpen ? 'text-accent' : ''}`}>
                  {isOpen && <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />}{session.date}
                </div>
                {session.description && <div className="text-xs text-muted mt-0.5">{session.description}</div>}
              </Link></td>
              <td className="py-4 text-right text-muted"><Link href={href} className="block">{session.player_count}</Link></td>
              <td className="py-4 text-right">{!isOpen && session.winner
                ? <Link href={`/groups/${groupId}/players/${session.winner.player_id}`} className="text-muted hover:text-accent transition-colors">{session.winner.name}</Link>
                : <span className="text-muted">—</span>}</td>
              <td className="py-4 text-right text-muted"><Link href={href} className="block">{session.exchange_rate ? `${session.exchange_rate}:1` : '—'}</Link></td>
              <td className="py-4 text-right"><DeleteSessionButton groupId={groupId} sessionId={session.id} /></td>
            </tr>
          })}
        </tbody>
      </table>
      <SessionPagination sessionsPath={sessionsPath} page={page} pageSize={pageSize} totalPages={totalPages} />
    </>
  )
}
