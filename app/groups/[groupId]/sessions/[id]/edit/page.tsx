import { notFound, redirect } from 'next/navigation'
import EditSessionForm from '@/components/EditSessionForm'
import { getSessionForEdit } from '@/lib/queries'

export default async function EditSessionPage({ params }: { params: Promise<{ groupId: string; id: string }> }) {
  const { groupId, id } = await params
  const session = await getSessionForEdit(groupId, id)
  if (!session) notFound()
  if (session.status === 'OPEN') redirect(`/groups/${groupId}/sessions/${id}`)
  return <EditSessionForm groupId={groupId} sessionId={id} session={session} />
}
