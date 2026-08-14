import { withAuth } from '@/lib/http'
import { settleSession } from '@/lib/mutations'
import { parseSettleSessionCommand, readCommand } from '@/lib/commands'

export const POST = withAuth(async (req, { params }: { params: Promise<{ groupId: string; id: string }> }) => {
  const { groupId, id } = await params
  const { finals, force } = await readCommand(req, parseSettleSessionCommand)
  return Response.json(await settleSession(groupId, id, finals, force))
})
