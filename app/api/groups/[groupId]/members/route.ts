import { withAuth } from '@/lib/http'
import { setGroupMemberActive } from '@/lib/mutations'

type Ctx = { params: Promise<{ groupId: string }> }

export const POST = withAuth(async (req, { params }: Ctx) => {
  const { groupId } = await params
  const { player_id } = await req.json() as { player_id: string }
  await setGroupMemberActive(groupId, player_id, true)
  return new Response(null, { status: 204 })
})

export const PATCH = withAuth(async (req, { params }: Ctx) => {
  const { groupId } = await params
  const { player_id, active } = await req.json() as { player_id: string; active: boolean }
  await setGroupMemberActive(groupId, player_id, active)
  return new Response(null, { status: 204 })
})
