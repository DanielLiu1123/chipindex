import { withAuth } from '@/lib/http'
import { addBatchParticipants } from '@/lib/live-session-mutations'
import { parseBatchBuyInCommand, readCommand } from '@/lib/commands'

export const POST = withAuth(async (req, { params }: { params: Promise<{ groupId: string; id: string }> }) => {
  const { groupId, id } = await params
  const command = await readCommand(req, parseBatchBuyInCommand)
  return Response.json(await addBatchParticipants(groupId, id, command), { status: 201 })
})
