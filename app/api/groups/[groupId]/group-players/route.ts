import { withAuth } from '@/lib/http'
import { createGroupPlayer, deleteGroupPlayer } from '@/lib/mutations'

type Ctx = { params: Promise<{ groupId: string }> }

export const POST = withAuth(async (req, { params }: Ctx) => {
  const { groupId } = await params
  const { player_id } = await req.json() as { player_id: string }
  return Response.json(await createGroupPlayer(groupId, player_id), { status: 201 })
})

export const DELETE = withAuth(async (req, { params }: Ctx) => {
  const { groupId } = await params
  const { player_id } = await req.json() as { player_id: string }
  return Response.json(await deleteGroupPlayer(groupId, player_id))
})
