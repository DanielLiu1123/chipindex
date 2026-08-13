import Link from 'next/link'
import { notFound } from 'next/navigation'
import PlayerStatsChart from '@/components/PlayerStatsChart'
import PlayerSessionHistoryTable from '@/components/PlayerSessionHistoryTable'
import { getPlayerDetail } from '@/lib/queries'
import { computePlayerHistory } from '@/lib/stats'

export const dynamic = 'force-dynamic'

export default async function PlayerDetailPage({ params }: { params: Promise<{ groupId: string; id: string }> }) {
  const { groupId, id } = await params
  const player = await getPlayerDetail(groupId, id)
  if (!player) notFound()
  const { history, totalCny, totalChips, wins, pogCount } = computePlayerHistory(player)
  return <>
    <div className="mb-6"><Link href={`/groups/${groupId}`} className="text-muted text-xs hover:text-white tracking-widest">← LEADERBOARD</Link></div>
    {!player.active && <p className="mb-3 text-[10px] text-muted tracking-widest">INACTIVE GROUP MEMBER</p>}
    <PlayerStatsChart groupId={groupId} id={id} initialName={player.name} data={history} totalCny={totalCny}
      totalChips={totalChips} sessions={history.length} wins={wins} pogCount={pogCount} />
    <p className="text-xs text-muted tracking-widest mb-4">SESSION HISTORY</p>
    <PlayerSessionHistoryTable groupId={groupId} rows={[...history].reverse()} />
  </>
}
