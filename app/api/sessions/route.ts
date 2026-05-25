import { isAuthenticated } from '@/lib/auth'
import { selectMany, insertOne, insertMany } from '@/lib/db'

export async function GET() {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  return Response.json(await selectMany('sessions', 'select=*,session_entries(count)&order=date.desc'))
}

export async function POST(req: Request) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { date, exchange_rate, entries } = await req.json() as {
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
  return Response.json(session, { status: 201 })
}
