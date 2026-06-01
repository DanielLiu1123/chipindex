import { isAuthenticated } from '@/lib/auth'
import { db } from '@/lib/db'

// 结算：录每人最终筹码，跑守恒校验（Σfinal === Σbuyin），通过则关局。
// 守恒不平时默认拒绝（返回差额）；force=true 可强行结算（留下不平的历史，类似旧脏账）。
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { finals, force } = await req.json() as {
    finals: { player_id: string; final_chips: number }[]
    force?: boolean
  }

  const { data: session } = await db.from('session').select('status').eq('id', id).single()
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })
  if (session.status !== 'OPEN') return Response.json({ error: 'Session is not open' }, { status: 409 })

  // 当前参与者
  const { data: parts } = await db
    .from('session_participant')
    .select('player_id')
    .is('deleted_at', null)
    .eq('session_id', id)
  const participantIds = new Set(((parts ?? []) as { player_id: string }[]).map(p => p.player_id))
  if (participantIds.size === 0) return Response.json({ error: 'No participants' }, { status: 400 })

  // 校验 finals 覆盖所有参与者且合法
  const finalMap = new Map<string, number>()
  for (const f of finals ?? []) {
    if (!Number.isInteger(f.final_chips) || f.final_chips < 0) {
      return Response.json({ error: `Invalid final_chips for ${f.player_id}` }, { status: 400 })
    }
    finalMap.set(f.player_id, f.final_chips)
  }
  for (const pid of participantIds) {
    if (!finalMap.has(pid)) return Response.json({ error: `Missing final_chips for participant ${pid}` }, { status: 400 })
  }

  // 守恒校验
  const { data: buyins } = await db
    .from('buy_in')
    .select('amount')
    .is('deleted_at', null)
    .eq('session_id', id)
  const totalBuyin = ((buyins ?? []) as { amount: number }[]).reduce((s, b) => s + b.amount, 0)
  let totalFinal = 0
  for (const pid of participantIds) totalFinal += finalMap.get(pid)!
  const diff = totalFinal - totalBuyin

  if (diff !== 0 && !force) {
    return Response.json(
      { error: 'unbalanced', diff, total_buyin: totalBuyin, total_final: totalFinal },
      { status: 422 },
    )
  }

  // 写入每人 final_chips + 锁定时刻
  const now = new Date().toISOString()
  for (const pid of participantIds) {
    const { error } = await db
      .from('session_participant')
      .update({ final_chips: finalMap.get(pid)!, settled_at: now, updated_at: now })
      .eq('session_id', id)
      .eq('player_id', pid)
      .is('deleted_at', null)
    if (error) return Response.json({ error: error.message }, { status: 500 })
  }

  const { error: sErr } = await db
    .from('session')
    .update({ status: 'SETTLED', ended_at: now, updated_at: now })
    .eq('id', id)
  if (sErr) return Response.json({ error: sErr.message }, { status: 500 })

  return Response.json({ id, diff })
}
