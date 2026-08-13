import { notFound } from 'next/navigation'
import GroupSettings from '@/components/GroupSettings'
import { getGroup, getGroupPlayers, getPlayersAndGroups } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function GroupSettingsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const [group, groupPlayers, playersAndGroups] = await Promise.all([
    getGroup(groupId),
    getGroupPlayers(groupId),
    getPlayersAndGroups(),
  ])
  if (!group) notFound()
  return <GroupSettings group={group} initialGroupPlayers={groupPlayers} playersAndGroups={playersAndGroups} />
}
