import { db } from '@/lib/db'
import LeaderboardView from '@/components/LeaderboardView'
import type { Player, PlayerStats } from '@/types'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  const [{ data: players }, { data: sessions }] = await Promise.all([
    db.from('players').select('*').is('deleted_at', null),
    db.from('sessions').select('id, date, exchange_rate, session_entries(player_id, chips)').is('deleted_at', null).order('date', { ascending: true }),
  ])

  const stats: PlayerStats[] = (players ?? [])
    .map((player: Player) => {
      let total_chips = 0
      let total_yuan = 0
      let sessions_played = 0
      let wins = 0

      for (const session of (sessions ?? []) as any[]) {
        const entry = (session.session_entries ?? []).find((e: any) => e.player_id === player.id)
        if (!entry) continue
        sessions_played++
        total_chips += entry.chips
        if (entry.chips > 0) wins++
        if (session.exchange_rate) total_yuan += entry.chips / session.exchange_rate
      }

      return {
        player,
        total_chips,
        total_yuan: Math.round(total_yuan),
        sessions_played,
        wins,
        win_rate: sessions_played > 0 ? wins / sessions_played : 0,
      }
    })
    .sort((a: PlayerStats, b: PlayerStats) => {
      if (b.total_yuan !== a.total_yuan) return b.total_yuan - a.total_yuan
      if (b.total_chips !== a.total_chips) return b.total_chips - a.total_chips
      return a.player.name.localeCompare(b.player.name)
    })

  return <LeaderboardView stats={stats} sessions={sessions ?? []} />
}
