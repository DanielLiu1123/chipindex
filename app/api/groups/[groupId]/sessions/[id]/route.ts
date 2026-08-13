import { withAuth, ApiError } from '@/lib/http'
import { getSessionForEdit } from '@/lib/queries'
import { updateSettledSession, softDeleteSession, type EditedParticipant } from '@/lib/mutations'

type Ctx = { params: Promise<{ groupId: string; id: string }> }

export const GET = withAuth(async (_req, { params }: Ctx) => {
  const { groupId, id } = await params
  const data = await getSessionForEdit(groupId, id)
  if (!data) throw new ApiError(404, 'Not found')
  return Response.json(data)
})

export const PUT = withAuth(async (req, { params }: Ctx) => {
  const { groupId, id } = await params
  const { date, exchange_rate, description, participants, force } = await req.json() as {
    date: string
    exchange_rate: number
    description: string | null
    participants: EditedParticipant[]
    force?: boolean
  }
  return Response.json(await updateSettledSession(groupId, id, { date, exchange_rate, description }, participants, force ?? false))
})

export const DELETE = withAuth(async (_req, { params }: Ctx) => {
  const { groupId, id } = await params
  await softDeleteSession(groupId, id)
  return new Response(null, { status: 204 })
})
