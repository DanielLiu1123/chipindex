import { notFound } from 'next/navigation'
import NewSessionForm from '@/components/NewSessionForm'
import { getGroup, getPlayersForLiveSession } from '@/lib/queries'

export default async function NewSessionPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  if (!await getGroup(groupId)) notFound()
  const players = await getPlayersForLiveSession(groupId)
  return <NewSessionForm groupId={groupId} initialPlayers={players} />
}
