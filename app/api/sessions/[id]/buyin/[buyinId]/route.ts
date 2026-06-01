import { isAuthenticated } from '@/lib/auth'
import { db } from '@/lib/db'

// 撤销单笔买入（软删除）
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; buyinId: string }> }) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id, buyinId } = await params
  const now = new Date().toISOString()
  const { error } = await db
    .from('buy_in')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', buyinId)
    .eq('session_id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
