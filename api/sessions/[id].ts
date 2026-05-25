import type { VercelRequest, VercelResponse } from '@vercel/node'
import { selectOne } from '../_lib/supabase'
import { withAuth } from '../_lib/auth'

export default withAuth(async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.status(405).end(); return }
  const { id } = req.query as { id: string }
  const data = await selectOne('sessions', `id=eq.${id}&select=*,session_entries(*,players(*))`)
  res.json(data)
})
