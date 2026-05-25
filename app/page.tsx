import Link from 'next/link'
import { db } from '@/lib/db'
import ChipValue from '@/components/ChipValue'
import type { Player, SessionEntry, PlayerStats } from '@/types'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  const [{ data: players }, { data: entries }] = await Promise.all([
    db.from('players').select('*'),
    db.from('session_entries').select('*'),
  ])

  const stats: PlayerStats[] = (players ?? [])
    .map((player: Player) => {
      const pe = (entries ?? []).filter((e: SessionEntry) => e.player_id === player.id)
      const total_chips = pe.reduce((s, e) => s + e.chips, 0)
      const wins = pe.filter(e => e.chips > 0).length
      return { player, total_chips, sessions_played: pe.length, wins, win_rate: pe.length > 0 ? wins / pe.length : 0 }
    })
    .sort((a: PlayerStats, b: PlayerStats) => b.total_chips - a.total_chips)

  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-xs text-muted tracking-widest">LEADERBOARD</h1>
        <Link href="/sessions/new" className="text-xs text-accent tracking-widest hover:underline">+ NEW SESSION</Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted text-xs tracking-widest">
            <th className="text-left py-3 font-normal w-8">#</th>
            <th className="text-left py-3 font-normal">PLAYER</th>
            <th className="text-right py-3 font-normal">CHIPS</th>
            <th className="text-right py-3 font-normal">SESSIONS</th>
            <th className="text-right py-3 font-normal">WIN%</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => (
            <tr key={s.player.id} className="border-b border-border hover:bg-surface transition-colors">
              <td className="py-4 text-muted text-xs">{i + 1}</td>
              <td className="py-4">
                <Link href={`/players/${s.player.id}`} className="hover:text-accent transition-colors">
                  {s.player.name}
                </Link>
              </td>
              <td className="py-4 text-right"><ChipValue chips={s.total_chips} /></td>
              <td className="py-4 text-right text-muted">{s.sessions_played}</td>
              <td className="py-4 text-right text-muted">{(s.win_rate * 100).toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
