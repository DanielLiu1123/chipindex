import { withAuth } from '@/lib/http'
import { importSession, startSession } from '@/lib/mutations'
import { parseCreateSessionCommand, readCommand } from '@/lib/commands'

export const POST = withAuth(async (req, { params }: { params: Promise<{ groupId: string }> }) => {
  const { groupId } = await params
  const body = await readCommand(req, parseCreateSessionCommand)
  const meta = { date: body.date, exchange_rate: body.exchange_rate, description: body.description }
  const session = body.status === 'OPEN'
    ? await startSession(groupId, meta, body.players)
    : await importSession(groupId, meta, body.entries)
  return Response.json(session, { status: 201 })
})
