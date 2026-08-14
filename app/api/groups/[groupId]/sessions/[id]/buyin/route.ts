import { withAuth } from '@/lib/http'
import { addBuyin } from '@/lib/mutations'

export const POST = withAuth(async (req, { params }: { params: Promise<{ groupId: string; id: string }> }) => {
  const { groupId, id } = await params
  const { player_id, amount } = await req.json() as { player_id: string; amount: number }
  return Response.json(await addBuyin(groupId, id, player_id, amount), { status: 201 })
})
