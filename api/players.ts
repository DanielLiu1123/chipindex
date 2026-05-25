import type { VercelRequest, VercelResponse } from '@vercel/node'
import { selectMany, insertOne } from './_lib/supabase'
import { withAuth } from './_lib/auth'

export default withAuth(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const data = await selectMany('players', 'order=name')
    res.json(data)
    return
  }
  if (req.method === 'POST') {
    const { name } = req.body as { name: string }
    if (!name?.trim()) { res.status(400).json({ error: 'Name required' }); return }
    const data = await insertOne('players', { name: name.trim() })
    res.status(201).json(data)
    return
  }
  res.status(405).end()
})
