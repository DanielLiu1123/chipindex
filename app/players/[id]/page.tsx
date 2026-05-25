import Link from 'next/link'
import { db } from '@/lib/db'
import PlayerStatsChart from '@/components/PlayerStatsChart'
import PlayerSessionHistoryTable from '@/components/PlayerSessionHistoryTable'

export const dynamic = 'force-dynamic'

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: player } = await db
    .from('players')
    .select('*, session_entries(*, sessions(*, session_entries(player_id, chips)))')
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
    return { date: e.sessions.date, session_id: e.session_id, chips: e.chips, cumulative, cny, cumulative_cny: cumulativeCny, description: e.sessions.description ?? null }
  })

  const totalCny = history.length > 0 ? history[history.length - 1].cumulative_cny : 0
  const totalChips = history.length > 0 ? history[history.length - 1].cumulative : 0
  const wins = sessionsSorted.filter((e: any) => e.chips > 0).length
  const pogCount = sessionsSorted.filter((e: any) => {
    const allChips = (e.sessions.session_entries ?? []).map((x: any) => x.chips)
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
