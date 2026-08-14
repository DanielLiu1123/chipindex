import { withAuth } from '@/lib/http'
import { addBuyin } from '@/lib/mutations'
import { parseBuyInCommand, readCommand } from '@/lib/commands'

export const POST = withAuth(async (req, { params }: { params: Promise<{ groupId: string; id: string }> }) => {
  const { groupId, id } = await params
  const { player_id, amount } = await readCommand(req, parseBuyInCommand)
  return Response.json(await addBuyin(groupId, id, player_id, amount), { status: 201 })
})
