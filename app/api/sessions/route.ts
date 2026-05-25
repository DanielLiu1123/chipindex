import { isAuthenticated } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await db
    .from('sessions')
    .select('*, session_entries(chips, player_id, players(name))')
    .is('deleted_at', null)
    .order('date', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { date, exchange_rate, description, entries } = await req.json() as {
    date: string
    exchange_rate: number | null
    description: string | null
    entries: { player_id: string; chips: number }[]
  }
  const { data: session, error } = await db.from('sessions').insert({ date, exchange_rate, description: description || null }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  const { error: entriesError } = await db.from('session_entries').insert(
    entries.map(e => ({ session_id: session.id, player_id: e.player_id, chips: e.chips }))
  )
  if (entriesError) return Response.json({ error: entriesError.message }, { status: 500 })
  return Response.json(session, { status: 201 })
}
