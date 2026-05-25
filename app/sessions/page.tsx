import Link from 'next/link'
import { db } from '@/lib/db'
import DeleteSessionButton from '@/components/DeleteSessionButton'

export const dynamic = 'force-dynamic'

interface SessionEntry {
  chips: number
  player_id: string
  players: { name: string } | null
}

interface Session {
  id: string
  date: string
  description: string | null
  exchange_rate: number
  session_entries: SessionEntry[]
}

function getWinner(entries: SessionEntry[]): { name: string; player_id: string } | null {
  if (!entries || entries.length === 0) return null
  const top = entries.reduce((best, e) => e.chips > best.chips ? e : best, entries[0])
  return top.players ? { name: top.players.name, player_id: top.player_id } : null
}

export default async function SessionsPage() {
  const { data } = await db
    .from('sessions')
    .select('id, date, description, exchange_rate, session_entries(chips, player_id, players(name))')
    .is('deleted_at', null)
    .order('date', { ascending: false })

  const sessions = (data ?? []) as unknown as Session[]

  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <span className="text-xs text-muted tracking-widest">{sessions.length} SESSIONS</span>
        <Link href="/sessions/new" className="text-xs text-accent tracking-widest hover:underline">+ NEW SESSION</Link>
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
            const winner = getWinner(s.session_entries)
            return (
              <tr key={s.id} className="border-b border-border hover:bg-surface transition-colors">
                <td className="py-4">
                  <Link href={`/sessions/${s.id}`} className="block">
                    <div>{s.date}</div>
                    {s.description && <div className="text-xs text-muted mt-0.5">{s.description}</div>}
                  </Link>
                </td>
                <td className="py-4 text-right text-muted">
                  <Link href={`/sessions/${s.id}`} className="block">{s.session_entries?.length ?? 0}</Link>
                </td>
                <td className="py-4 text-right">
                  {winner
                    ? <Link href={`/players/${winner.player_id}`} className="text-muted hover:text-accent transition-colors">{winner.name}</Link>
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
