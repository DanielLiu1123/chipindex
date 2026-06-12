import { withAuth } from '@/lib/http'
import { settleSession, type FinalEntry } from '@/lib/mutations'

// Settle the session. Rejects with 422 + diff when the conservation check
// fails, unless force=true.
export const POST = withAuth(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const { finals, force } = await req.json() as { finals: FinalEntry[]; force?: boolean }
  return Response.json(await settleSession(id, finals, force ?? false))
})
