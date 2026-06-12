import { withAuth } from '@/lib/http'
import { getPlayers } from '@/lib/queries'
import { createPlayer } from '@/lib/mutations'

export const GET = withAuth(async () => {
  return Response.json(await getPlayers())
})

export const POST = withAuth(async (req) => {
  const { name } = await req.json() as { name: string }
  return Response.json(await createPlayer(name), { status: 201 })
})
