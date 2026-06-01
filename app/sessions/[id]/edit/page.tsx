import { notFound, redirect } from 'next/navigation'
import EditSessionForm from '@/components/EditSessionForm'
import { getSessionStatus } from '@/lib/queries'

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const status = await getSessionStatus(id)
  if (!status) notFound()
  // OPEN sessions are edited via the live page; there is no edit form for them
  if (status === 'OPEN') redirect(`/sessions/${id}`)
  return <EditSessionForm sessionId={id} />
}
