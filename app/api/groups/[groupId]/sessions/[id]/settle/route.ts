import { withAuth } from '@/lib/http'
import { settleSession, type FinalEntry } from '@/lib/mutations'

export const POST = withAuth(async (req, { params }: { params: Promise<{ groupId: string; id: string }> }) => {
  const { groupId, id } = await params
  const { finals, force } = await req.json() as { finals: FinalEntry[]; force?: boolean }
  return Response.json(await settleSession(groupId, id, finals, force ?? false))
})
