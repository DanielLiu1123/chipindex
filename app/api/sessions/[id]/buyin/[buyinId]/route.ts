import { withAuth } from '@/lib/http'
import { revokeBuyin } from '@/lib/mutations'

export const DELETE = withAuth(async (_req, { params }: { params: Promise<{ id: string; buyinId: string }> }) => {
  const { id, buyinId } = await params
  await revokeBuyin(id, buyinId)
  return new Response(null, { status: 204 })
})
