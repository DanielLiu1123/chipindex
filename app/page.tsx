import { getPlayers, getLeaderboardSessions } from '@/lib/queries'
import { computeLeaderboardStats } from '@/lib/stats'
import LeaderboardView from '@/components/LeaderboardView'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  const [players, sessions] = await Promise.all([
    getPlayers(),
    getLeaderboardSessions(),
  ])

  const stats = computeLeaderboardStats(players, sessions)

  return <LeaderboardView stats={stats} sessions={sessions} />
}
