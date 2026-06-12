import { withAuth } from '@/lib/http'
import { importSession, startSession, type ImportEntry, type StartingPlayer } from '@/lib/mutations'

// status === 'OPEN' opens a live session; otherwise imports a finished
// session from per-player net results.
export const POST = withAuth(async (req) => {
  const body = await req.json() as {
    date: string
    exchange_rate: number
    description: string | null
    status?: string
    entries?: ImportEntry[]
    players?: StartingPlayer[]
  }
  const meta = { date: body.date, exchange_rate: body.exchange_rate, description: body.description }

  const session = body.status === 'OPEN'
    ? await startSession(meta, body.players ?? [])
    : await importSession(meta, body.entries ?? [])
  return Response.json(session, { status: 201 })
})
