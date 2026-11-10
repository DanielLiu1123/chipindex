import headerStyles from '@/components/ResponsiveActions.module.css'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { notFound } from 'next/navigation'
import SessionEntriesTable from '@/components/SessionEntriesTable'
import LiveSession from '@/components/LiveSession'
import CopySessionSummaryButton from '@/components/CopySessionSummaryButton'
import { getGroup, getPlayersWithActivity, getSessionPageData } from '@/lib/queries'
import type { SessionSummaryData } from '@/lib/session-summary'

export const dynamic = 'force-dynamic'

export default async function SessionDetailPage({ params }: { params: Promise<{ groupId: string; id: string }> }) {
  const { groupId, id } = await params
  const data = await getSessionPageData(groupId, id)
  if (!data) notFound()
  if (data.status === 'OPEN') {
    const players = await getPlayersWithActivity(groupId)
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
    <div className={`${headerStyles.container} mb-4`}>
      <div className={headerStyles.row}>
        <h1 className={`${headerStyles.date} font-medium tracking-tight text-foreground`}>{settled.date}</h1>
        <div className={headerStyles.actions}>
          <CopySessionSummaryButton summary={summary} />
          <Button asChild variant="outline" className={`${headerStyles.action} h-9 gap-2 rounded-[8px] px-3 text-xs text-muted-foreground`}>
            <Link href={`/groups/${groupId}/sessions/${id}/edit`} aria-label="Edit session" title="Edit session">
              <Pencil aria-hidden="true" className="size-3.5" strokeWidth={1.6} />
              <span className={headerStyles.label}>EDIT</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
    <div className="mb-2"><span className="text-xs text-muted-foreground">{settled.exchange_rate} chips = 1 CNY</span></div>
    <div className="mb-6">{settled.description && <p className="text-sm text-muted-foreground mt-1">{settled.description}</p>}</div>
    <SessionEntriesTable groupId={groupId} entries={entries} exchangeRate={settled.exchange_rate} total={total} />
  </>
}
