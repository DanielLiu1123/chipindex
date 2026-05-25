import { db } from '@/lib/db'
import LeaderboardView from '@/components/LeaderboardView'
import type { Player, PlayerStats } from '@/types'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  const [{ data: players }, { data: sessions }] = await Promise.all([
    db.from('players').select('*').is('deleted_at', null),
    db.from('sessions').select('id, date, exchange_rate, session_entries(player_id, chips)').is('deleted_at', null).order('date', { ascending: true }),
  ])

  const allSessions = (sessions ?? []) as any[]

  // precompute max chips per session to identify top winner
  const sessionMaxChips = new Map<string, number>()
  for (const session of allSessions) {
    const chips = (session.session_entries ?? []).map((e: any) => e.chips)
    sessionMaxChips.set(session.id, chips.length > 0 ? Math.max(...chips) : 0)
  }

  const stats: PlayerStats[] = (players ?? [])
    .map((player: Player) => {
      let total_chips = 0
      let total_yuan = 0
      let sessions_played = 0
      let wins = 0
      let pog_count = 0

      for (const session of allSessions) {
        const entry = (session.session_entries ?? []).find((e: any) => e.player_id === player.id)
        if (!entry) continue
        sessions_played++
        total_chips += entry.chips
        if (entry.chips > 0) wins++
        total_yuan += entry.chips / session.exchange_rate
        if (entry.chips === sessionMaxChips.get(session.id)) pog_count++
      }

      return {
        player,
        total_chips,
        total_yuan: Math.round(total_yuan),
        sessions_played,
        wins,
        win_rate: sessions_played > 0 ? wins / sessions_played : 0,
        pog_count,
      }
    })
    .sort((a: PlayerStats, b: PlayerStats) => {
      if (b.total_yuan !== a.total_yuan) return b.total_yuan - a.total_yuan
      if (b.total_chips !== a.total_chips) return b.total_chips - a.total_chips
      return a.player.name.localeCompare(b.player.name)
    })

  return <LeaderboardView stats={stats} sessions={sessions ?? []} />
}
