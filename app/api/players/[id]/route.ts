import { withAuth } from '@/lib/http'
import { renamePlayer } from '@/lib/mutations'

export const PATCH = withAuth(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const { name } = await req.json() as { name: string }
  return Response.json(await renamePlayer(id, name))
})
