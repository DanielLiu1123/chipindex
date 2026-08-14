import { withAuth } from '@/lib/http'
import { updateSettledSession, softDeleteSession } from '@/lib/mutations'
import { parseUpdateSessionCommand, readCommand } from '@/lib/commands'

type Ctx = { params: Promise<{ groupId: string; id: string }> }

export const PUT = withAuth(async (req, { params }: Ctx) => {
  const { groupId, id } = await params
  const { date, exchange_rate, description, participants, force } = await readCommand(req, parseUpdateSessionCommand)
  return Response.json(await updateSettledSession(groupId, id, { date, exchange_rate, description }, participants, force))
})

export const DELETE = withAuth(async (_req, { params }: Ctx) => {
  const { groupId, id } = await params
  await softDeleteSession(groupId, id)
  return new Response(null, { status: 204 })
})
