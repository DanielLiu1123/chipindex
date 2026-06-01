import { isAuthenticated } from '@/lib/auth'
import { db } from '@/lib/db'
import { synthFromNet, BUY_IN_UNIT } from '@/lib/synth'

export async function POST(req: Request) {
  if (!await isAuthenticated()) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json() as {
    date: string
    exchange_rate: number
    description: string | null
    status?: string
    entries?: { player_id: string; chips: number }[]
    players?: { player_id: string; initial_buyin: number }[]
  }

  // status === 'OPEN' → open a session: create OPEN session + participants + initial buy-ins (only persist a buy-in when amount>0)
  if (body.status === 'OPEN') {
    return startSession(body)
  }

  // otherwise → import a finished session after the fact: net synthesizes buy_in + final_chips
  const { date, exchange_rate, description, entries = [] } = body

  const { data: session, error } = await db
    .from('session')
    .insert({ date, exchange_rate, description: description || null, status: 'SETTLED', buy_in_unit: BUY_IN_UNIT })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const now = new Date().toISOString()
  const participants = entries.map(e => {
    const { final_chips } = synthFromNet(e.chips)
    return { session_id: session.id, player_id: e.player_id, final_chips, settled_at: now }
  })
  const buyins = entries.map(e => {
    const { amount } = synthFromNet(e.chips)
    return { session_id: session.id, player_id: e.player_id, amount }
  })

  const { error: pErr } = await db.from('session_participant').insert(participants)
  if (pErr) return Response.json({ error: pErr.message }, { status: 500 })
  const { error: bErr } = await db.from('buy_in').insert(buyins)
  if (bErr) return Response.json({ error: bErr.message }, { status: 500 })

  return Response.json(session, { status: 201 })
}

async function startSession(body: {
  date: string
  exchange_rate: number
  description: string | null
  players?: { player_id: string; initial_buyin: number }[]
}) {
  const { date, exchange_rate, description, players = [] } = body
  if (players.length === 0) return Response.json({ error: 'At least one player required' }, { status: 400 })
  for (const p of players) {
    if (!p.player_id) return Response.json({ error: 'player_id required' }, { status: 400 })
    if (!Number.isInteger(p.initial_buyin) || p.initial_buyin < 0) {
      return Response.json({ error: 'initial_buyin must be a non-negative integer' }, { status: 400 })
    }
  }

  const { data: session, error } = await db
    .from('session')
    .insert({
      date,
      exchange_rate: exchange_rate ?? 40,
      description: description || null,
      status: 'OPEN',
      buy_in_unit: BUY_IN_UNIT,
      started_at: new Date().toISOString(),
    })
    .select()
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { error: pErr } = await db
    .from('session_participant')
    .insert(players.map(p => ({ session_id: session.id, player_id: p.player_id })))
  if (pErr) return Response.json({ error: pErr.message }, { status: 500 })

  const buyins = players
    .filter(p => p.initial_buyin > 0)
    .map(p => ({ session_id: session.id, player_id: p.player_id, amount: p.initial_buyin }))
  if (buyins.length > 0) {
    const { error: bErr } = await db.from('buy_in').insert(buyins)
    if (bErr) return Response.json({ error: bErr.message }, { status: 500 })
  }

  return Response.json(session, { status: 201 })
}
