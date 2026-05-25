import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './_lib/supabase'
import { withAuth } from './_lib/auth'

export default withAuth(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('players').select('*').order('name')
    if (error) { res.status(500).json({ error: error.message }); return }
    res.json(data)
    return
  }

  if (req.method === 'POST') {
    const { name } = req.body as { name: string }
    if (!name?.trim()) { res.status(400).json({ error: 'Name required' }); return }
    const { data, error } = await supabase.from('players').insert({ name: name.trim() }).select().single()
    if (error) { res.status(500).json({ error: error.message }); return }
    res.status(201).json(data)
    return
  }

  res.status(405).end()
})
