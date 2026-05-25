import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './_lib/supabase'
import { withAuth } from './_lib/auth'

export default withAuth(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, session_entries(count)')
      .order('date', { ascending: false })
    if (error) { res.status(500).json({ error: error.message }); return }
    res.json(data)
    return
  }

  if (req.method === 'POST') {
    const { date, exchange_rate, entries } = req.body as {
      date: string
      exchange_rate: number | null
      entries: { player_id: string; chips: number }[]
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({ date, exchange_rate })
      .select()
      .single()
    if (sessionError) { res.status(500).json({ error: sessionError.message }); return }

    const { error: entriesError } = await supabase
      .from('session_entries')
      .insert(entries.map(e => ({ session_id: session.id, player_id: e.player_id, chips: e.chips })))
    if (entriesError) { res.status(500).json({ error: entriesError.message }); return }

    res.status(201).json(session)
    return
  }

  res.status(405).end()
})
