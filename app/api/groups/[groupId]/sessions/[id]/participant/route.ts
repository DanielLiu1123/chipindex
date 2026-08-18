import { withAuth } from '@/lib/http'
import { addParticipant, removeParticipant } from '@/lib/live-session-mutations'
import { parseGroupPlayerCommand, readCommand } from '@/lib/commands'

type Ctx = { params: Promise<{ groupId: string; id: string }> }

export const POST = withAuth(async (req, { params }: Ctx) => {
  const { groupId, id } = await params
  const { player_id } = await readCommand(req, parseGroupPlayerCommand)
  return Response.json(await addParticipant(groupId, id, player_id), { status: 201 })
})

export const DELETE = withAuth(async (req, { params }: Ctx) => {
  const { groupId, id } = await params
  const { player_id } = await readCommand(req, parseGroupPlayerCommand)
  await removeParticipant(groupId, id, player_id)
  return new Response(null, { status: 204 })
})
