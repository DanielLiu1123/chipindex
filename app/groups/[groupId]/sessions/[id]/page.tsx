import Link from 'next/link'
import { notFound } from 'next/navigation'
import SessionEntriesTable from '@/components/SessionEntriesTable'
import LiveSession from '@/components/LiveSession'
import CopySessionSummaryButton from '@/components/CopySessionSummaryButton'
import { getGroup, getPlayers, getSessionPageData } from '@/lib/queries'
import type { SessionSummaryData } from '@/lib/session-summary'

export const dynamic = 'force-dynamic'

export default async function SessionDetailPage({ params }: { params: Promise<{ groupId: string; id: string }> }) {
  const { groupId, id } = await params
  const data = await getSessionPageData(groupId, id)
  if (!data) notFound()
  if (data.status === 'OPEN') {
    const players = await getPlayers(groupId)
    return <LiveSession groupId={groupId} session={data.session} allPlayers={players} />
  }

  const settled = data.session
  const group = await getGroup(groupId)
  if (!group) notFound()
  const summary: SessionSummaryData = {
    group_name: group.name,
    date: settled.date,
    exchange_rate: settled.exchange_rate,
    ...(settled.started_at === null
      ? { started_at: null, ended_at: null }
      : { started_at: settled.started_at, ended_at: settled.ended_at }),
    participants: settled.session_entries.map(entry => ({
      player_id: entry.player_id,
      name: entry.players?.name ?? entry.player_id,
      final_chips: entry.final_chips,
      buy_ins: entry.buy_ins,
    })),
  }
  const entries = [...settled.session_entries]
    .sort((a, b) => b.chips - a.chips || a.player_id.localeCompare(b.player_id))
  const total = entries.reduce((sum, entry) => sum + entry.chips, 0)
  return <>
    <div className="mb-6"><Link href={`/groups/${groupId}/sessions`} className="text-muted text-xs hover:text-white tracking-widest">← SESSIONS</Link></div>
    <div className="flex items-center justify-between mb-2">
      <h1 className="text-white">{settled.date}</h1>
      <div className="flex items-center gap-2">
        <CopySessionSummaryButton summary={summary} />
        <Link href={`/groups/${groupId}/sessions/${id}/edit`} className="text-xs text-accent tracking-widest border border-accent/50 hover:border-accent px-2.5 py-1 transition-colors">EDIT</Link>
      </div>
    </div>
    <div className="mb-2"><span className="text-xs text-muted">{settled.exchange_rate} chips = 1 CNY</span></div>
    <div className="mb-6">{settled.description && <p className="text-sm text-muted mt-1">{settled.description}</p>}</div>
    <SessionEntriesTable groupId={groupId} entries={entries} exchangeRate={settled.exchange_rate} total={total} />
  </>
}
