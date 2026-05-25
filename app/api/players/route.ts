import { isAuthenticated } from '@/lib/auth'
import { selectMany, insertOne } from '@/lib/db'

export async function GET() {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  return Response.json(await selectMany('players', 'order=name'))
}

export async function POST(req: Request) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { name } = await req.json() as { name: string }
  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })
  return Response.json(await insertOne('players', { name: name.trim() }), { status: 201 })
}
