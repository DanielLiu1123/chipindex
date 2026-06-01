import { isAuthenticated } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await db.from('player').select('*').is('deleted_at', null).order('name')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: Request) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { name } = await req.json() as { name: string }
  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })
  const { data, error } = await db.from('player').insert({ name: name.trim() }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
