import { withAuth, ApiError } from '@/lib/http'
import { getSessionForEdit } from '@/lib/queries'
import { updateSettledSession, softDeleteSession, type EditedParticipant } from '@/lib/mutations'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withAuth(async (_req, { params }: Ctx) => {
  const { id } = await params
  const data = await getSessionForEdit(id)
  if (!data) throw new ApiError(404, 'Not found')
  return Response.json(data)
})

export const PUT = withAuth(async (req, { params }: Ctx) => {
  const { id } = await params
  const { date, exchange_rate, description, participants, force } = await req.json() as {
    date: string
    exchange_rate: number
    description: string | null
    participants: EditedParticipant[]
    force?: boolean
  }
  const result = await updateSettledSession(id, { date, exchange_rate, description }, participants, force ?? false)
  return Response.json(result)
})

export const DELETE = withAuth(async (_req, { params }: Ctx) => {
  const { id } = await params
  await softDeleteSession(id)
  return new Response(null, { status: 204 })
})
