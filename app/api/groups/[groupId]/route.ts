import { withAuth, ApiError } from '@/lib/http'
import { getGroup } from '@/lib/queries'
import { renameGroup } from '@/lib/group-mutations'
import { parseNameCommand, readCommand } from '@/lib/commands'

type Ctx = { params: Promise<{ groupId: string }> }

export const GET = withAuth(async (_req, { params }: Ctx) => {
  const { groupId } = await params
  const group = await getGroup(groupId)
  if (!group) throw new ApiError(404, 'Group not found')
  return Response.json(group)
})

export const PATCH = withAuth(async (req, { params }: Ctx) => {
  const { groupId } = await params
  const { name } = await readCommand(req, parseNameCommand)
  return Response.json(await renameGroup(groupId, name))
})
