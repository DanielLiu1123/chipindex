import { parseCashOutParticipantCommand, parseGroupPlayerCommand, readCommand } from '@/lib/commands'
import { withAuth } from '@/lib/http'
import { cashOutParticipant, undoParticipantCashOut } from '@/lib/live-session-mutations'

type Ctx = { params: Promise<{ groupId: string; id: string }> }

export const POST = withAuth(async (req, { params }: Ctx) => {
  const { groupId, id } = await params
  const { player_id, final_chips } = await readCommand(req, parseCashOutParticipantCommand)
  return Response.json(await cashOutParticipant(groupId, id, player_id, final_chips))
})

export const DELETE = withAuth(async (req, { params }: Ctx) => {
  const { groupId, id } = await params
  const { player_id } = await readCommand(req, parseGroupPlayerCommand)
  await undoParticipantCashOut(groupId, id, player_id)
  return new Response(null, { status: 204 })
})
