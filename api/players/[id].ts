import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_lib/supabase'
import { withAuth } from '../_lib/auth'

export default withAuth(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).end(); return }

  const { id } = req.query as { id: string }
  const { data, error } = await supabase
    .from('players')
    .select('*, session_entries(*, sessions(*))')
    .eq('id', id)
    .single()

  if (error) { res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: error.message }); return }
  res.json(data)
})
