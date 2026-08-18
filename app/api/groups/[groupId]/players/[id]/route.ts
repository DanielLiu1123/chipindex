import { withAuth } from '@/lib/http'
import { renamePlayer } from '@/lib/group-mutations'
import { parseNameCommand, readCommand } from '@/lib/commands'

export const PATCH = withAuth(async (req, { params }: { params: Promise<{ groupId: string; id: string }> }) => {
  const { groupId, id } = await params
  const { name } = await readCommand(req, parseNameCommand)
  return Response.json(await renamePlayer(groupId, id, name))
})
