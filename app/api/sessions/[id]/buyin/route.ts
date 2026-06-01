import { isAuthenticated } from '@/lib/auth'
import { db } from '@/lib/db'

// 记一笔买入。amount 为任意正整数 chips（不必是 unit 倍数）。
// 懒创建 participant：第一次买入时自动把该玩家加入本局。
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { player_id, amount } = await req.json() as { player_id: string; amount: number }

  if (!player_id) return Response.json({ error: 'player_id required' }, { status: 400 })
  if (!Number.isInteger(amount) || amount <= 0) return Response.json({ error: 'amount must be a positive integer' }, { status: 400 })

  // 局必须是 OPEN
  const { data: session } = await db.from('session').select('status').eq('id', id).single()
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })
  if (session.status !== 'OPEN') return Response.json({ error: 'Session is not open' }, { status: 409 })

  // 确保 participant 存在
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
