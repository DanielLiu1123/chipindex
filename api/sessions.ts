import type { VercelRequest, VercelResponse } from '@vercel/node'
import { selectMany, insertOne, insertMany } from './_lib/supabase'
import { withAuth } from './_lib/auth'

export default withAuth(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const data = await selectMany('sessions', 'select=*,session_entries(count)&order=date.desc')
    res.json(data)
    return
  }
  if (req.method === 'POST') {
    const { date, exchange_rate, entries } = req.body as {
      date: string
      exchange_rate: number | null
      entries: { player_id: string; chips: number }[]
    }
    const session = await insertOne('sessions', { date, exchange_rate })
    await insertMany('session_entries', entries.map(e => ({
      session_id: session.id,
      player_id: e.player_id,
      chips: e.chips,
    })))
    res.status(201).json(session)
    return
  }
  res.status(405).end()
})
