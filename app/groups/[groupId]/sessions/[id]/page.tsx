import Link from 'next/link'
import { notFound } from 'next/navigation'
import SessionEntriesTable from '@/components/SessionEntriesTable'
import LiveSession from '@/components/LiveSession'
import { getSessionDetail, getLiveSession, getPlayers } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function SessionDetailPage({ params }: { params: Promise<{ groupId: string; id: string }> }) {
  const { groupId, id } = await params
  const [session, players] = await Promise.all([getLiveSession(groupId, id), getPlayers(groupId)])
  if (!session) notFound()
  if (session.status === 'OPEN') return <LiveSession groupId={groupId} session={session} allPlayers={players} />

  const settled = await getSessionDetail(groupId, id)
  if (!settled) notFound()
  const entries = [...settled.session_entries].sort((a, b) => b.chips - a.chips)
  const total = entries.reduce((sum, entry) => sum + entry.chips, 0)
  return <>
    <div className="mb-6"><Link href={`/groups/${groupId}/sessions`} className="text-muted text-xs hover:text-white tracking-widest">← SESSIONS</Link></div>
    <div className="flex items-center justify-between mb-2">
      <h1 className="text-white">{settled.date}</h1>
      <Link href={`/groups/${groupId}/sessions/${id}/edit`} className="text-xs text-accent tracking-widest border border-accent/50 hover:border-accent px-2.5 py-1 transition-colors">EDIT</Link>
    </div>
    <div className="mb-2"><span className="text-xs text-muted">{settled.exchange_rate} chips = 1 CNY</span></div>
    <div className="mb-6">{settled.description && <p className="text-sm text-muted mt-1">{settled.description}</p>}</div>
    <SessionEntriesTable groupId={groupId} entries={entries} exchangeRate={settled.exchange_rate} total={total} />
  </>
}
