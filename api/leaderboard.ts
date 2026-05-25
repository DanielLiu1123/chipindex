import type { VercelRequest, VercelResponse } from '@vercel/node'
import { selectMany } from './_lib/supabase'
import { withAuth } from './_lib/auth'

export default withAuth(async function handler(_req: VercelRequest, res: VercelResponse) {
  const [players, entries] = await Promise.all([
    selectMany('players'),
    selectMany('session_entries'),
  ])

  const stats = players
    .map((player: any) => {
      const pe = entries.filter((e: any) => e.player_id === player.id)
      const total_chips = pe.reduce((s: number, e: any) => s + e.chips, 0)
      const wins = pe.filter((e: any) => e.chips > 0).length
      return {
        player,
        total_chips,
        sessions_played: pe.length,
        wins,
        win_rate: pe.length > 0 ? wins / pe.length : 0,
      }
    })
    .sort((a: any, b: any) => b.total_chips - a.total_chips)

  res.json(stats)
})
