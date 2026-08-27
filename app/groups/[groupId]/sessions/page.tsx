import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import SessionList from '@/components/SessionList'
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted tracking-widest">{total} SESSIONS</span>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <Link href={`/groups/${groupId}/sessions/new`} className="inline-flex min-h-11 items-center text-xs tracking-widest text-accent hover:underline sm:min-h-0">+ NEW SESSION</Link>
          <Link href={`/groups/${groupId}/sessions/import`} className="inline-flex min-h-11 items-center text-xs tracking-widest text-accent hover:underline sm:min-h-0">IMPORT SESSION</Link>
        </div>
      </div>
      <SessionList groupId={groupId} sessions={sessions} />
      <SessionPagination sessionsPath={sessionsPath} page={page} pageSize={pageSize} totalPages={totalPages} />
    </>
  )
}
