import Link from 'next/link'
import { notFound } from 'next/navigation'
import SessionEntriesTable from '@/components/SessionEntriesTable'
import LiveSession from '@/components/LiveSession'
import { getSessionStatus, getSessionDetail, getLiveSession, getPlayers } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const status = await getSessionStatus(id)
  if (!status) notFound()

  // OPEN 局 → 实时记账界面（与 settled 详情同一个 URL，按状态分流）
  if (status === 'OPEN') {
    const [session, players] = await Promise.all([getLiveSession(id), getPlayers()])
    if (!session) notFound()
    return <LiveSession session={session} allPlayers={players} />
  }

  // SETTLED → 结算详情
  const typed = await getSessionDetail(id)
  if (!typed) notFound()

  const entries = [...typed.session_entries].sort((a, b) => b.chips - a.chips)
  const total = entries.reduce((s, e) => s + e.chips, 0)

  return (
    <>
      <div className="mb-6">
        <Link href="/sessions" className="text-muted text-xs hover:text-white tracking-widest">← SESSIONS</Link>
      </div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-white">{typed.date}</h1>
        <Link href={`/sessions/${id}/edit`} className="text-xs text-accent tracking-widest border border-accent/50 hover:border-accent px-2.5 py-1 transition-colors">EDIT</Link>
      </div>
      <div className="mb-2">
        <span className="text-xs text-muted">
          {typed.exchange_rate} chips = 1 CNY
        </span>
      </div>
      <div className="mb-6">
        {typed.description && <p className="text-sm text-muted mt-1">{typed.description}</p>}
      </div>
      <SessionEntriesTable entries={entries} exchangeRate={typed.exchange_rate} total={total} />
    </>
  )
}
