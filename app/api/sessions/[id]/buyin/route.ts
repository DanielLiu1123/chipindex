import { withAuth } from '@/lib/http'
import { addBuyin } from '@/lib/mutations'

// Record a buy-in. amount is any positive integer of chips (need not be a
// multiple of the session's unit).
export const POST = withAuth(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const { player_id, amount } = await req.json() as { player_id: string; amount: number }
  return Response.json(await addBuyin(id, player_id, amount), { status: 201 })
})
