import { withAuth } from '@/lib/http'
import { restoreGroupPlayer, softDeleteGroupPlayer } from '@/lib/mutations'

type Ctx = { params: Promise<{ groupId: string }> }

export const POST = withAuth(async (req, { params }: Ctx) => {
  const { groupId } = await params
  const { player_id } = await req.json() as { player_id: string }
  return Response.json(await restoreGroupPlayer(groupId, player_id))
})

export const DELETE = withAuth(async (req, { params }: Ctx) => {
  const { groupId } = await params
  const { player_id } = await req.json() as { player_id: string }
  return Response.json(await softDeleteGroupPlayer(groupId, player_id))
})
