import { notFound } from 'next/navigation'
import GroupSettings from '@/components/GroupSettings'
import { getGlobalPlayersWithGroups, getGroup, getGroupMembers } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function GroupSettingsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const [group, members, players] = await Promise.all([
    getGroup(groupId),
    getGroupMembers(groupId),
    getGlobalPlayersWithGroups(),
  ])
  if (!group) notFound()
  return <GroupSettings group={group} initialMembers={members} globalPlayers={players} />
}
