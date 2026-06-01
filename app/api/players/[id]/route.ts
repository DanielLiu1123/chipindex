import { isAuthenticated } from '@/lib/auth'
import { db } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { name } = await req.json() as { name: string }
  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })
  const { data, error } = await db
    .from('player')
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
