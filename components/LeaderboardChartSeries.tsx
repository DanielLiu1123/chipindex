import { useMemo } from 'react'
import LeaderboardChart from '@/components/LeaderboardChart'
import { buildChartData } from '@/lib/leaderboard'
import type { LeaderboardSessionRow } from '@/lib/domain-types'
import type { PlayerStats } from '@/lib/stats'

export default function LeaderboardChartSeries({ sessions, stats, mode }: {
  sessions: LeaderboardSessionRow[]
  stats: PlayerStats[]
  mode: 'chips' | 'cny'
}) {
  const data = useMemo(() => buildChartData(sessions, stats, mode), [sessions, stats, mode])
  return <LeaderboardChart data={data} players={stats.map(stat => stat.player)} mode={mode} />
}
