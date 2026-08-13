import { notFound } from 'next/navigation'
import { getGroup, getLeaderboardPlayers, getLeaderboardSessions } from '@/lib/queries'
import { computeLeaderboardStats } from '@/lib/stats'
import LeaderboardView from '@/components/LeaderboardView'

export const dynamic = 'force-dynamic'

export default async function GroupLeaderboardPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const [group, players, sessions] = await Promise.all([
    getGroup(groupId),
    getLeaderboardPlayers(groupId),
    getLeaderboardSessions(groupId),
  ])
  if (!group) notFound()
  return <LeaderboardView groupId={groupId} stats={computeLeaderboardStats(players, sessions)} sessions={sessions} />
}
