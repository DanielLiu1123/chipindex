import Link from 'next/link'
import { db } from '@/lib/db'
import ChipValue from '@/components/ChipValue'

export const dynamic = 'force-dynamic'

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: session } = await db
    .from('sessions')
    .select('*, session_entries(*, players(*))')
    .eq('id', id)
    .single()

  const entries = [...(session?.session_entries ?? [])].sort((a: any, b: any) => b.chips - a.chips)
  const total = entries.reduce((s: number, e: any) => s + e.chips, 0)

  return (
    <>
      <div className="mb-6">
        <Link href="/sessions" className="text-muted text-xs hover:text-white tracking-widest">← SESSIONS</Link>
      </div>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-white">{session?.date}</h1>
        <div className="flex items-baseline gap-4">
          <span className="text-xs text-muted">
            {session?.exchange_rate ? `${session.exchange_rate} chips = 1 yuan` : 'no rate set'}
          </span>
          <Link href={`/sessions/${id}/edit`} className="text-xs text-muted hover:text-white tracking-widest transition-colors">EDIT →</Link>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted text-xs tracking-widest">
            <th className="text-left py-3 font-normal">PLAYER</th>
            <th className="text-right py-3 font-normal">CHIPS</th>
            {session?.exchange_rate && <th className="text-right py-3 font-normal">YUAN</th>}
          </tr>
        </thead>
        <tbody>
          {entries.map((e: any) => (
            <tr key={e.id} className="border-b border-border hover:bg-surface transition-colors">
              <td className="py-4">
                <Link href={`/players/${e.player_id}`} className="hover:text-accent transition-colors">
                  {e.players?.name ?? e.player_id}
                </Link>
              </td>
              <td className="py-4 text-right"><ChipValue chips={e.chips} /></td>
              {session?.exchange_rate && (
                <td className="py-4 text-right text-muted">
                  <ChipValue chips={Math.round(e.chips / session.exchange_rate)} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-muted text-xs">
            <td className="pt-4">SUM</td>
            <td className="pt-4 text-right"><ChipValue chips={total} /></td>
            {session?.exchange_rate && <td />}
          </tr>
        </tfoot>
      </table>
    </>
  )
}
