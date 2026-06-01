import Link from 'next/link'
import { notFound } from 'next/navigation'
import PlayerStatsChart from '@/components/PlayerStatsChart'
import PlayerSessionHistoryTable from '@/components/PlayerSessionHistoryTable'
import { getPlayerDetail } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const player = await getPlayerDetail(id)

  if (!player) notFound()

  const sessionsSorted = [...player.entries]
    .sort((a, b) => a.sessions.date.localeCompare(b.sessions.date))

  let cumulative = 0
  let cumulativeCny = 0
  const history = sessionsSorted.map(e => {
    cumulative += e.chips
    const cny = Math.round(e.chips / e.sessions.exchange_rate)
    cumulativeCny += cny
    return { date: e.sessions.date, session_id: e.session_id, chips: e.chips, cumulative, cny, cumulative_cny: cumulativeCny, description: e.sessions.description }
  })

  const totalCny = history.length > 0 ? history[history.length - 1].cumulative_cny : 0
  const totalChips = history.length > 0 ? history[history.length - 1].cumulative : 0
  const wins = sessionsSorted.filter(e => e.chips > 0).length
  const pogCount = sessionsSorted.filter(e => {
    const allChips = e.sessions.session_entries.map(x => x.chips)
    return allChips.length > 0 && e.chips === Math.max(...allChips)
  }).length

  return (
    <>
      <div className="mb-6">
        <Link href="/" className="text-muted text-xs hover:text-white tracking-widest">← LEADERBOARD</Link>
      </div>
      <PlayerStatsChart
        id={id}
        initialName={player?.name ?? ''}
        data={history}
        totalCny={totalCny}
        totalChips={totalChips}
        sessions={sessionsSorted.length}
        wins={wins}
        pogCount={pogCount}
      />

      <p className="text-xs text-muted tracking-widest mb-4">SESSION HISTORY</p>
      <PlayerSessionHistoryTable rows={[...history].reverse()} />
    </>
  )
}
