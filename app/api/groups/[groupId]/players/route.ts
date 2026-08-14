import { withAuth, ApiError } from '@/lib/http'
import { getGroup, getPlayers } from '@/lib/queries'
import { createPlayer } from '@/lib/mutations'

type Ctx = { params: Promise<{ groupId: string }> }

export const GET = withAuth(async (_req, { params }: Ctx) => {
  const { groupId } = await params
  if (!await getGroup(groupId)) throw new ApiError(404, 'Group not found')
  return Response.json(await getPlayers(groupId))
})

export const POST = withAuth(async (req, { params }: Ctx) => {
  const { groupId } = await params
  const { name } = await req.json() as { name: string }
  return Response.json(await createPlayer(name, groupId), { status: 201 })
})
