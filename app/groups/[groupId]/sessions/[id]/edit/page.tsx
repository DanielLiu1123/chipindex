import { notFound, redirect } from 'next/navigation'
import EditSessionForm from '@/components/EditSessionForm'
import { getSessionStatus } from '@/lib/queries'

export default async function EditSessionPage({ params }: { params: Promise<{ groupId: string; id: string }> }) {
  const { groupId, id } = await params
  const status = await getSessionStatus(groupId, id)
  if (!status) notFound()
  if (status === 'OPEN') redirect(`/groups/${groupId}/sessions/${id}`)
  return <EditSessionForm groupId={groupId} sessionId={id} />
}
