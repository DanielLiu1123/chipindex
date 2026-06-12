import { withAuth } from '@/lib/http'
import { addParticipant, removeParticipant } from '@/lib/mutations'

type Ctx = { params: Promise<{ id: string }> }

// Add a player to the session without a buy-in. To create a new player,
// call /api/players first.
export const POST = withAuth(async (req, { params }: Ctx) => {
  const { id } = await params
  const { player_id } = await req.json() as { player_id: string }
  return Response.json(await addParticipant(id, player_id), { status: 201 })
})

// Remove a mistakenly added player along with their buy-ins.
export const DELETE = withAuth(async (req, { params }: Ctx) => {
  const { id } = await params
  const { player_id } = await req.json() as { player_id: string }
  await removeParticipant(id, player_id)
  return new Response(null, { status: 204 })
})
