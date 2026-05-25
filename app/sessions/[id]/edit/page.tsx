import SessionForm from '@/components/SessionForm'

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SessionForm mode="edit" sessionId={id} />
}
