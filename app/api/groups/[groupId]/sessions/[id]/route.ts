import { withAuth } from '@/lib/http'
import { updateSession, softDeleteSession } from '@/lib/session-mutations'
import { parseUpdateSessionCommand, readCommand } from '@/lib/commands'

type Ctx = { params: Promise<{ groupId: string; id: string }> }

export const PUT = withAuth(async (req, { params }: Ctx) => {
  const { groupId, id } = await params
  const command = await readCommand(req, parseUpdateSessionCommand)
  return Response.json(await updateSession(groupId, id, command))
})

export const DELETE = withAuth(async (_req, { params }: Ctx) => {
  const { groupId, id } = await params
  await softDeleteSession(groupId, id)
  return new Response(null, { status: 204 })
})
