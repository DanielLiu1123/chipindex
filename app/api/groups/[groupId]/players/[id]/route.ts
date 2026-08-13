import { withAuth } from '@/lib/http'
import { renamePlayer } from '@/lib/mutations'

export const PATCH = withAuth(async (req, { params }: { params: Promise<{ groupId: string; id: string }> }) => {
  const { groupId, id } = await params
  const { name } = await req.json() as { name: string }
  return Response.json(await renamePlayer(groupId, id, name))
})
