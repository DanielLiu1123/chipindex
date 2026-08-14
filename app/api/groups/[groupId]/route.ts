import { withAuth, ApiError } from '@/lib/http'
import { getGroup } from '@/lib/queries'
import { renameGroup } from '@/lib/mutations'

type Ctx = { params: Promise<{ groupId: string }> }

export const GET = withAuth(async (_req, { params }: Ctx) => {
  const { groupId } = await params
  const group = await getGroup(groupId)
  if (!group) throw new ApiError(404, 'Group not found')
  return Response.json(group)
})

export const PATCH = withAuth(async (req, { params }: Ctx) => {
  const { groupId } = await params
  const { name } = await req.json() as { name: string }
  return Response.json(await renameGroup(groupId, name))
})
