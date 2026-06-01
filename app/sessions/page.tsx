import Link from 'next/link'
import DeleteSessionButton from '@/components/DeleteSessionButton'
import { getSessionsList } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function SessionsPage() {
  const sessions = await getSessionsList()

  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <span className="text-xs text-muted tracking-widest">{sessions.length} SESSIONS</span>
        <div className="flex items-center gap-4">
          <Link href="/sessions/new" className="text-xs text-accent tracking-widest hover:underline">+ NEW SESSION</Link>
          <Link href="/sessions/import" className="text-xs text-accent tracking-widest hover:underline">IMPORT SESSION</Link>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted text-xs tracking-widest">
            <th className="text-left py-3 font-normal">DATE</th>
            <th className="text-right py-3 font-normal">PLAYERS</th>
            <th className="text-right py-3 font-normal">WINNER</th>
            <th className="text-right py-3 font-normal">RATE</th>
            <th className="text-right py-3 font-normal"></th>
          </tr>
        </thead>
        <tbody>
          {sessions.length === 0 && (
            <tr>
              <td colSpan={5} className="py-12 text-center text-xs text-muted tracking-widest">NO SESSIONS YET</td>
            </tr>
          )}
          {sessions.map(s => {
            const isOpen = s.status === 'OPEN'
            return (
              <tr key={s.id} className={`border-b border-border transition-colors ${isOpen ? 'bg-accent/5 hover:bg-accent/10' : 'hover:bg-surface'}`}>
                <td className="py-4">
                  <Link href={`/sessions/${s.id}`} className="block">
                    <div className={`flex items-center gap-2 ${isOpen ? 'text-accent' : ''}`}>
                      {isOpen && <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />}
                      {s.date}
                    </div>
                    {s.description && <div className="text-xs text-muted mt-0.5">{s.description}</div>}
                  </Link>
                </td>
                <td className="py-4 text-right text-muted">
                  <Link href={`/sessions/${s.id}`} className="block">{s.player_count}</Link>
                </td>
                <td className="py-4 text-right">
                  {!isOpen && s.winner
                    ? <Link href={`/players/${s.winner.player_id}`} className="text-muted hover:text-accent transition-colors">{s.winner.name}</Link>
                    : <span className="text-muted">—</span>}
                </td>
                <td className="py-4 text-right text-muted">
                  <Link href={`/sessions/${s.id}`} className="block">{s.exchange_rate ? `${s.exchange_rate}:1` : '—'}</Link>
                </td>
                <td className="py-4 text-right">
                  <DeleteSessionButton sessionId={s.id} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
