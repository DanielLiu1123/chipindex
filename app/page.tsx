import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getGroups } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function LeaderboardPage() {
  const groups = await getGroups()
  if (groups.length === 0) redirect('/groups/new')
  const store = await cookies()
  const remembered = store.get('chipindex_group')?.value
  const group = groups.find(item => item.id === remembered) ?? groups[0]
  redirect(`/groups/${group.id}`)
}
