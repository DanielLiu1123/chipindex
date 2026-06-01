import { isAuthenticated } from '@/lib/auth'
import { db } from '@/lib/db'
import { getSessionForEdit } from '@/lib/queries'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const data = await getSessionForEdit(id)
  if (!data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(data)
}

// Edit a settled session: directly change the buy-in flow + final chips. Net is derived by the view.
// Rewrite participant + buy_in for the whole session; buy_in.created_at is sent back by the client to preserve original timestamps.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { date, exchange_rate, description, participants, force } = await req.json() as {
    date: string
    exchange_rate: number
    description: string | null
    participants: { player_id: string; final_chips: number; buy_ins: { amount: number; created_at?: string }[] }[]
    force?: boolean
  }

  if (!participants || participants.length === 0) return Response.json({ error: 'At least one player required' }, { status: 400 })

  // validation
  let totalBuyin = 0
  let totalFinal = 0
  for (const p of participants) {
    if (!p.player_id) return Response.json({ error: 'player_id required' }, { status: 400 })
    if (!Number.isInteger(p.final_chips) || p.final_chips < 0) {
      return Response.json({ error: `Invalid final_chips for ${p.player_id}` }, { status: 400 })
    }
    for (const b of p.buy_ins) {
      if (!Number.isInteger(b.amount) || b.amount <= 0) {
        return Response.json({ error: `Invalid buy-in amount for ${p.player_id}` }, { status: 400 })
      }
      totalBuyin += b.amount
    }
    totalFinal += p.final_chips
  }

  // conservation check
  const diff = totalFinal - totalBuyin
  if (diff !== 0 && !force) {
    return Response.json({ error: 'unbalanced', diff, total_buyin: totalBuyin, total_final: totalFinal }, { status: 422 })
  }

  const now = new Date().toISOString()
  const { error: updateError } = await db
    .from('session')
    .update({ date, exchange_rate, description: description || null, updated_at: now })
    .eq('id', id)
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 })

  // rewrite the whole session
  const [{ error: delP }, { error: delB }] = await Promise.all([
    db.from('session_participant').delete().eq('session_id', id),
    db.from('buy_in').delete().eq('session_id', id),
  ])
  if (delP) return Response.json({ error: delP.message }, { status: 500 })
  if (delB) return Response.json({ error: delB.message }, { status: 500 })

  const participantRows = participants.map(p => ({
    session_id: id, player_id: p.player_id, final_chips: p.final_chips, settled_at: now,
  }))
  const buyinRows = participants.flatMap(p =>
    p.buy_ins.map(b => ({
      session_id: id,
      player_id: p.player_id,
      amount: b.amount,
      ...(b.created_at ? { created_at: b.created_at } : {}),
    }))
  )
  const { error: pErr } = await db.from('session_participant').insert(participantRows)
  if (pErr) return Response.json({ error: pErr.message }, { status: 500 })
  if (buyinRows.length > 0) {
    const { error: bErr } = await db.from('buy_in').insert(buyinRows)
    if (bErr) return Response.json({ error: bErr.message }, { status: 500 })
  }

  return Response.json({ id, diff })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { error } = await db
    .from('session')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}
