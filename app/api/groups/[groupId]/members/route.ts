import { withAuth } from '@/lib/http'
import { restoreGroupMember, softDeleteGroupMember } from '@/lib/mutations'

type Ctx = { params: Promise<{ groupId: string }> }

export const POST = withAuth(async (req, { params }: Ctx) => {
  const { groupId } = await params
  const { player_id } = await req.json() as { player_id: string }
  await restoreGroupMember(groupId, player_id)
  return new Response(null, { status: 204 })
})

export const DELETE = withAuth(async (req, { params }: Ctx) => {
  const { groupId } = await params
  const { player_id } = await req.json() as { player_id: string }
  await softDeleteGroupMember(groupId, player_id)
  return new Response(null, { status: 204 })
})
