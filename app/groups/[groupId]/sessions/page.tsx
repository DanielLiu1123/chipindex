import Link from 'next/link'
import { notFound } from 'next/navigation'
import DeleteSessionButton from '@/components/DeleteSessionButton'
import { getGroup, getSessionsPage } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function SessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>
  searchParams: Promise<{ page?: string | string[] }>
}) {
  const { groupId } = await params
  const pageParam = (await searchParams).page
  const parsedPage = Number(Array.isArray(pageParam) ? pageParam[0] : pageParam ?? '1')
  const requestedPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
  const [group, sessionsPage] = await Promise.all([getGroup(groupId), getSessionsPage(groupId, requestedPage)])
  if (!group) notFound()
  const { sessions, page, total, total_pages: totalPages } = sessionsPage
  const sessionsPath = `/groups/${groupId}/sessions`
  const pageHref = (target: number) => target === 1 ? sessionsPath : `${sessionsPath}?page=${target}`

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
          <th className="text-right py-3 font-normal">WINNER</th><th className="text-right py-3 font-normal">RATE</th>
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
      {totalPages > 1 && <nav aria-label="Sessions pagination"
        className="mt-6 flex items-center justify-between text-xs tracking-widest">
        {page > 1
          ? <Link href={pageHref(page - 1)} className="text-muted hover:text-white transition-colors">← PREVIOUS</Link>
          : <span className="text-muted/30">← PREVIOUS</span>}
        <span className="text-muted">PAGE {page} / {totalPages}</span>
        {page < totalPages
          ? <Link href={pageHref(page + 1)} className="text-muted hover:text-white transition-colors">NEXT →</Link>
          : <span className="text-muted/30">NEXT →</span>}
      </nav>}
    </>
  )
}
