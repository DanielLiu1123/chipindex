import { notFound } from 'next/navigation'
import SessionForm from '@/components/SessionForm'
import { getGroup, getPlayersWithActivity } from '@/lib/queries'

export default async function ImportSessionPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  if (!await getGroup(groupId)) notFound()
  const players = await getPlayersWithActivity(groupId)
  return <SessionForm groupId={groupId} initialPlayers={players} />
}
