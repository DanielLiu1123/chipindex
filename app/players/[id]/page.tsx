import Link from 'next/link'
import { db } from '@/lib/db'
import ChipValue from '@/components/ChipValue'
import PlayerChartSection from '@/components/PlayerChartSection'
import PlayerNameEditor from '@/components/PlayerNameEditor'
import PlayerSessionHistoryTable from '@/components/PlayerSessionHistoryTable'
import BestWorstSessions from '@/components/BestWorstSessions'

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
    return { date: e.sessions.date, session_id: e.session_id, chips: e.chips, cumulative, cny, cumulative_cny: cumulativeCny }
  })

  const totalCny = history.length > 0 ? history[history.length - 1].cumulative_cny : 0
  const totalChips = history.length > 0 ? history[history.length - 1].cumulative : 0
  const wins = sessionsSorted.filter((e: any) => e.chips > 0).length

  const bestSession = history.length > 0
    ? history.reduce((best, row) => row.cny > best.cny ? row : best, history[0])
    : null
  const worstSession = history.length > 0
    ? history.reduce((worst, row) => row.cny < worst.cny ? row : worst, history[0])
    : null

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

      <BestWorstSessions
        best={bestSession ? { session_id: bestSession.session_id, date: bestSession.date, cny: bestSession.cny, chips: bestSession.chips } : null}
        worst={worstSession ? { session_id: worstSession.session_id, date: worstSession.date, cny: worstSession.cny, chips: worstSession.chips } : null}
      />

      <p className="text-xs text-muted tracking-widest mb-4">SESSION HISTORY</p>
      <PlayerSessionHistoryTable rows={[...history].reverse()} />
    </>
  )
}
