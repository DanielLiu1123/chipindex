import { isAuthenticated } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { data, error } = await db
    .from('sessions')
    .select('*, session_entries(*)')
    .eq('id', id)
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { date, exchange_rate, entries } = await req.json() as {
    date: string
    exchange_rate: number | null
    entries: { player_id: string; chips: number }[]
  }

  const { error: updateError } = await db
    .from('sessions')
    .update({ date, exchange_rate })
    .eq('id', id)
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 })

  const { error: deleteError } = await db
    .from('session_entries')
    .delete()
    .eq('session_id', id)
  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 })

  const { error: insertError } = await db
    .from('session_entries')
    .insert(entries.map(e => ({ session_id: id, player_id: e.player_id, chips: e.chips })))
  if (insertError) return Response.json({ error: insertError.message }, { status: 500 })

  return Response.json({ id })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  const { error } = await db
    .from('sessions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return new Response(null, { status: 204 })
}
