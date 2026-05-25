import Link from 'next/link'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function SessionsPage() {
  const { data: sessions } = await db
    .from('sessions')
    .select('*, session_entries(count)')
    .order('date', { ascending: false })

  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-xs text-muted tracking-widest">SESSIONS</h1>
        <Link href="/sessions/new" className="text-xs text-accent tracking-widest hover:underline">+ NEW SESSION</Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted text-xs tracking-widest">
            <th className="text-left py-3 font-normal">DATE</th>
            <th className="text-right py-3 font-normal">PLAYERS</th>
            <th className="text-right py-3 font-normal">RATE</th>
            <th className="text-right py-3 font-normal"></th>
          </tr>
        </thead>
        <tbody>
          {(sessions ?? []).map((s: any) => (
            <tr key={s.id} className="border-b border-border hover:bg-surface transition-colors">
              <td className="py-4">{s.date}</td>
              <td className="py-4 text-right text-muted">{s.session_entries?.[0]?.count ?? 0}</td>
              <td className="py-4 text-right text-muted">{s.exchange_rate ? `${s.exchange_rate}:1` : '—'}</td>
              <td className="py-4 text-right">
                <Link href={`/sessions/${s.id}`} className="text-xs text-muted hover:text-white tracking-widest transition-colors">VIEW →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
