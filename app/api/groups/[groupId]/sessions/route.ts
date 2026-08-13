import { withAuth } from '@/lib/http'
import { importSession, startSession, type ImportEntry, type StartingPlayer } from '@/lib/mutations'

export const POST = withAuth(async (req, { params }: { params: Promise<{ groupId: string }> }) => {
  const { groupId } = await params
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
    ? await startSession(groupId, meta, body.players ?? [])
    : await importSession(groupId, meta, body.entries ?? [])
  return Response.json(session, { status: 201 })
})
