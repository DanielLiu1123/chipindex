import Link from 'next/link'
import DeleteSessionButton from '@/components/DeleteSessionButton'
import type { SessionRow } from '@/lib/queries'

export default function SessionList({
  groupId,
  sessions,
}: {
  groupId: string
  sessions: SessionRow[]
}) {
  return (
    <>
      <section className="sm:hidden" aria-label="Sessions">
        {sessions.length === 0 && (
          <p className="py-12 text-center text-xs tracking-widest text-muted">NO SESSIONS YET</p>
        )}
        {sessions.map(session => {
          const href = `/groups/${groupId}/sessions/${session.id}`
          const isOpen = session.status === 'OPEN'
          return (
            <article key={session.id} className={`border-b border-border py-4 ${isOpen ? 'bg-accent/5' : ''}`}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <Link href={href} className="min-w-0 flex-1">
                  <span className={`flex items-center gap-2 text-base ${isOpen ? 'text-accent' : 'text-white'}`}>
                    {isOpen && <span className="h-2 w-2 shrink-0 rounded-full bg-accent motion-safe:animate-pulse" />}
                    {session.date}
                  </span>
                  {session.description && <span className="mt-1 block truncate text-xs text-muted">{session.description}</span>}
                </Link>
                <DeleteSessionButton groupId={groupId} sessionId={session.id} />
              </div>
              <dl className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <dt className="mb-1 text-[9px] tracking-widest text-muted">PLAYERS</dt>
                  <dd className="text-white">{session.player_count} PLAYERS</dd>
                </div>
                <div className="min-w-0 text-center">
                  <dt className="mb-1 text-[9px] tracking-widest text-muted">WINNER</dt>
                  <dd className="truncate">
                    {!isOpen && session.winner
                      ? <Link href={`/groups/${groupId}/players/${session.winner.player_id}`} className="text-white">{session.winner.name}</Link>
                      : <span className="text-muted">—</span>}
                  </dd>
                </div>
                <div className="text-right">
                  <dt className="mb-1 text-[9px] tracking-widest text-muted">RATE</dt>
                  <dd className="text-white">{session.exchange_rate ? `${session.exchange_rate}:1` : '—'}</dd>
                </div>
              </dl>
            </article>
          )
        })}
      </section>

      <table className="hidden w-full text-sm sm:table">
        <thead><tr className="border-b border-border text-xs tracking-widest text-muted">
          <th className="py-3 text-left font-normal">DATE</th><th className="py-3 text-right font-normal">PLAYERS</th>
          <th className="py-3 text-right font-normal">WINNER</th><th className="py-3 text-right font-normal">RATE</th>
          <th className="py-3 text-right font-normal"></th>
        </tr></thead>
        <tbody>
          {sessions.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-xs tracking-widest text-muted">NO SESSIONS YET</td></tr>}
          {sessions.map(session => {
            const href = `/groups/${groupId}/sessions/${session.id}`
            const isOpen = session.status === 'OPEN'
            return <tr key={session.id} className={`border-b border-border transition-colors ${isOpen ? 'bg-accent/5 hover:bg-accent/10' : 'hover:bg-surface'}`}>
              <td className="py-4"><Link href={href} className="block">
                <div className={`flex items-center gap-2 ${isOpen ? 'text-accent' : ''}`}>
                  {isOpen && <span className="h-2 w-2 shrink-0 rounded-full bg-accent motion-safe:animate-pulse" />}{session.date}
                </div>
                {session.description && <div className="mt-0.5 text-xs text-muted">{session.description}</div>}
              </Link></td>
              <td className="py-4 text-right text-muted"><Link href={href} className="block">{session.player_count}</Link></td>
              <td className="py-4 text-right">{!isOpen && session.winner
                ? <Link href={`/groups/${groupId}/players/${session.winner.player_id}`} className="text-muted transition-colors hover:text-accent">{session.winner.name}</Link>
                : <span className="text-muted">—</span>}</td>
              <td className="py-4 text-right text-muted"><Link href={href} className="block">{session.exchange_rate ? `${session.exchange_rate}:1` : '—'}</Link></td>
              <td className="py-4 text-right"><DeleteSessionButton groupId={groupId} sessionId={session.id} /></td>
            </tr>
          })}
        </tbody>
      </table>
    </>
  )
}
