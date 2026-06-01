import Link from 'next/link'
import { notFound } from 'next/navigation'
import PlayerStatsChart from '@/components/PlayerStatsChart'
import PlayerSessionHistoryTable from '@/components/PlayerSessionHistoryTable'
import { getPlayerDetail } from '@/lib/queries'
import { computePlayerHistory } from '@/lib/stats'

export const dynamic = 'force-dynamic'

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const player = await getPlayerDetail(id)

  if (!player) notFound()

  const { history, totalCny, totalChips, wins, pogCount } = computePlayerHistory(player)

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
        sessions={history.length}
        wins={wins}
        pogCount={pogCount}
      />

      <p className="text-xs text-muted tracking-widest mb-4">SESSION HISTORY</p>
      <PlayerSessionHistoryTable rows={[...history].reverse()} />
    </>
  )
}
