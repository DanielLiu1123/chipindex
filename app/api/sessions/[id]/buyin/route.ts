import { isAuthenticated } from '@/lib/auth'
import { db } from '@/lib/db'

// Record a buy-in. amount is any positive integer of chips (need not be a multiple of unit).
// Lazily create the participant: the player is added to the session automatically on their first buy-in.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { player_id, amount } = await req.json() as { player_id: string; amount: number }

  if (!player_id) return Response.json({ error: 'player_id required' }, { status: 400 })
  if (!Number.isInteger(amount) || amount <= 0) return Response.json({ error: 'amount must be a positive integer' }, { status: 400 })

  // session must be OPEN
  const { data: session } = await db.from('session').select('status').eq('id', id).single()
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })
  if (session.status !== 'OPEN') return Response.json({ error: 'Session is not open' }, { status: 409 })

  // ensure the participant exists
  const { error: pErr } = await db
    .from('session_participant')
    .upsert({ session_id: id, player_id }, { onConflict: 'session_id,player_id', ignoreDuplicates: true })
  if (pErr) return Response.json({ error: pErr.message }, { status: 500 })

  const { data, error } = await db
    .from('buy_in')
    .insert({ session_id: id, player_id, amount })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
