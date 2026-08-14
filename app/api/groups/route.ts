import { withAuth } from '@/lib/http'
import { getGroups } from '@/lib/queries'
import { createGroup } from '@/lib/mutations'
import { parseNameCommand, readCommand } from '@/lib/commands'

export const GET = withAuth(async () => Response.json(await getGroups()))

export const POST = withAuth(async req => {
  const { name } = await readCommand(req, parseNameCommand)
  return Response.json(await createGroup(name), { status: 201 })
})
