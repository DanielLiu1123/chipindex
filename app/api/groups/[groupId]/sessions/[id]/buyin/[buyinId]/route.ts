import { withAuth } from '@/lib/http'
import { revokeBuyin } from '@/lib/mutations'

export const DELETE = withAuth(async (_req, { params }: { params: Promise<{ groupId: string; id: string; buyinId: string }> }) => {
  const { groupId, id, buyinId } = await params
  await revokeBuyin(groupId, id, buyinId)
  return new Response(null, { status: 204 })
})
