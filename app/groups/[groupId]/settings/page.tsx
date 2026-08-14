import { notFound } from 'next/navigation'
import GroupSettings from '@/components/GroupSettings'
import { getAllPlayers, getGroup, getGroupPlayers } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function GroupSettingsPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const [group, groupPlayers, players] = await Promise.all([
    getGroup(groupId),
    getGroupPlayers(groupId),
    getAllPlayers(),
  ])
  if (!group) notFound()
  return <GroupSettings group={group} initialGroupPlayers={groupPlayers} players={players} />
}
