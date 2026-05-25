import Link from 'next/link'
import { db } from '@/lib/db'
import ChipValue from '@/components/ChipValue'
import PlayerChartSection from '@/components/PlayerChartSection'
import PlayerNameEditor from '@/components/PlayerNameEditor'

export const dynamic = 'force-dynamic'

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: player } = await db
    .from('players')
    .select('*, session_entries(*, sessions(*))')
    .eq('id', id)
    .single()

  const sessionsSorted = [...(player?.session_entries ?? [])]
    .filter((e: any) => e.sessions && !e.sessions.deleted_at)
    .sort((a: any, b: any) => a.sessions.date.localeCompare(b.sessions.date))

  let cumulative = 0
  let cumulativeCny = 0
  const history = sessionsSorted.map((e: any) => {
    cumulative += e.chips
    const cny = Math.round(e.chips / e.sessions.exchange_rate)
    cumulativeCny += cny
    return { date: e.sessions.date, chips: e.chips, cumulative, cny, cumulative_cny: cumulativeCny }
  })

  const totalCny = history.length > 0 ? history[history.length - 1].cumulative_cny : 0
  const totalChips = history.length > 0 ? history[history.length - 1].cumulative : 0
  const wins = sessionsSorted.filter((e: any) => e.chips > 0).length

  return (
    <>
      <div className="mb-6">
        <Link href="/" className="text-muted text-xs hover:text-white tracking-widest">← LEADERBOARD</Link>
      </div>
      <div className="flex items-baseline justify-between mb-8">
        <PlayerNameEditor id={id} initialName={player?.name ?? ''} />
        <div className="flex gap-6 text-xs text-muted">
          <span>{sessionsSorted.length} sessions</span>
          <span>{wins} wins</span>
          <ChipValue chips={totalCny} prefix="¥" className="text-sm" />
        </div>
      </div>

      {history.length > 1 && (
        <PlayerChartSection data={history} totalCny={totalCny} totalChips={totalChips} />
      )}

      <p className="text-xs text-muted tracking-widest mb-4">SESSION HISTORY</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted text-xs tracking-widest">
            <th className="text-left py-3 font-normal">DATE</th>
            <th className="text-right py-3 font-normal">CNY</th>
            <th className="text-right py-3 font-normal">CHIPS</th>
            <th className="text-right py-3 font-normal">CUMULATIVE CNY</th>
          </tr>
        </thead>
        <tbody>
          {[...history].reverse().map((row, i) => {
            const entry = [...sessionsSorted].reverse()[i]
            return (
              <tr key={i} className="border-b border-border hover:bg-surface transition-colors">
                <td className="py-4">
                  <Link href={`/sessions/${entry.session_id}`} className="hover:text-accent transition-colors">
                    {row.date}
                  </Link>
                </td>
                <td className="py-4 text-right"><ChipValue chips={row.cny} prefix="¥" /></td>
                <td className="py-4 text-right"><ChipValue chips={row.chips} /></td>
                <td className="py-4 text-right"><ChipValue chips={row.cumulative_cny} prefix="¥" /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
