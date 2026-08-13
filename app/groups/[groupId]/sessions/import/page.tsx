import { notFound } from 'next/navigation'
import SessionForm from '@/components/SessionForm'
import { getGroup } from '@/lib/queries'

export default async function ImportSessionPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  if (!await getGroup(groupId)) notFound()
  return <SessionForm groupId={groupId} />
}
