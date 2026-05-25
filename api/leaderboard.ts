import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './_lib/supabase'
import { withAuth } from './_lib/auth'

export default withAuth(async function handler(_req: VercelRequest, res: VercelResponse) {
  const [{ data: players, error: e1 }, { data: entries, error: e2 }] = await Promise.all([
    supabase.from('players').select('*'),
    supabase.from('session_entries').select('*'),
  ])
  if (e1 || e2) {
    res.status(500).json({ error: (e1 ?? e2)?.message })
    return
  }

  const stats = (players ?? [])
    .map(player => {
      const playerEntries = (entries ?? []).filter((e: any) => e.player_id === player.id)
      const total_chips = playerEntries.reduce((sum: number, e: any) => sum + e.chips, 0)
      const wins = playerEntries.filter((e: any) => e.chips > 0).length
      return {
        player,
        total_chips,
        sessions_played: playerEntries.length,
        wins,
        win_rate: playerEntries.length > 0 ? wins / playerEntries.length : 0,
      }
    })
    .sort((a: any, b: any) => b.total_chips - a.total_chips)

  res.json(stats)
})
