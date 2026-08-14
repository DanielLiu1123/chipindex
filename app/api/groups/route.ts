import { withAuth } from '@/lib/http'
import { getGroups } from '@/lib/queries'
import { createGroup } from '@/lib/mutations'

export const GET = withAuth(async () => Response.json(await getGroups()))

export const POST = withAuth(async req => {
  const { name } = await req.json() as { name: string }
  return Response.json(await createGroup(name), { status: 201 })
})
