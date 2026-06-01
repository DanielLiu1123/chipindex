import { isAuthenticated } from '@/lib/auth'
import { db } from '@/lib/db'

// Add a player to the session (without a buy-in). To create a new player, call /api/players first.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { player_id } = await req.json() as { player_id: string }
  if (!player_id) return Response.json({ error: 'player_id required' }, { status: 400 })

  const { data: session } = await db.from('session').select('status').eq('id', id).single()
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })
  if (session.status !== 'OPEN') return Response.json({ error: 'Session is not open' }, { status: 409 })

  const { data, error } = await db
    .from('session_participant')
    .upsert({ session_id: id, player_id }, { onConflict: 'session_id,player_id', ignoreDuplicates: true })
    .select()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data?.[0] ?? null, { status: 201 })
}

// Remove a mistakenly added player (soft-delete them along with their buy-ins)
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { player_id } = await req.json() as { player_id: string }
  if (!player_id) return Response.json({ error: 'player_id required' }, { status: 400 })
  const now = new Date().toISOString()

  const [{ error: pErr }, { error: bErr }] = await Promise.all([
    db.from('session_participant').update({ deleted_at: now, updated_at: now }).eq('session_id', id).eq('player_id', player_id),
    db.from('buy_in').update({ deleted_at: now, updated_at: now }).eq('session_id', id).eq('player_id', player_id).is('deleted_at', null),
  ])
  if (pErr) return Response.json({ error: pErr.message }, { status: 500 })
  if (bErr) return Response.json({ error: bErr.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
