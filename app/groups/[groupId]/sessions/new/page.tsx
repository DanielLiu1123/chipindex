import { notFound } from 'next/navigation'
import NewSessionForm from '@/components/NewSessionForm'
import { getGroup } from '@/lib/queries'

export default async function NewSessionPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  if (!await getGroup(groupId)) notFound()
  return <NewSessionForm groupId={groupId} />
}
