import { notFound } from 'next/navigation'
import { getGroup, getLeaderboardData } from '@/lib/queries'
import LeaderboardView from '@/components/LeaderboardView'

export const dynamic = 'force-dynamic'

export default async function GroupLeaderboardPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const [group, leaderboard] = await Promise.all([
    getGroup(groupId),
    getLeaderboardData(groupId),
  ])
  if (!group) notFound()
  return <LeaderboardView
    groupId={groupId}
    players={leaderboard.players}
    sessions={leaderboard.sessions}
  />
}
