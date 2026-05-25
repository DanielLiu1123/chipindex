import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import PlayerStatsChart from '@/components/PlayerStatsChart'
import PlayerSessionHistoryTable from '@/components/PlayerSessionHistoryTable'

export const dynamic = 'force-dynamic'

interface SessionSummaryEntry {
  player_id: string
  chips: number
}

interface SessionData {
  id: string
  date: string
  description: string | null
  exchange_rate: number
  deleted_at: string | null
  session_entries: SessionSummaryEntry[]
}

interface PlayerEntry {
  session_id: string
  chips: number
  sessions: SessionData
}

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: player } = await db
    .from('players')
    .select('*, session_entries(*, sessions(*, session_entries(player_id, chips)))')
    .eq('id', id)
    .single()

  if (!player) notFound()

  const sessionsSorted = ([...(player.session_entries ?? [])] as unknown as PlayerEntry[])
    .filter(e => e.sessions && !e.sessions.deleted_at)
    .sort((a, b) => a.sessions.date.localeCompare(b.sessions.date))

  let cumulative = 0
  let cumulativeCny = 0
  const history = sessionsSorted.map(e => {
    cumulative += e.chips
    const cny = Math.round(e.chips / e.sessions.exchange_rate)
    cumulativeCny += cny
    return { date: e.sessions.date, session_id: e.session_id, chips: e.chips, cumulative, cny, cumulative_cny: cumulativeCny, description: e.sessions.description }
  })

  const totalCny = history.length > 0 ? history[history.length - 1].cumulative_cny : 0
  const totalChips = history.length > 0 ? history[history.length - 1].cumulative : 0
  const wins = sessionsSorted.filter(e => e.chips > 0).length
  const pogCount = sessionsSorted.filter(e => {
    const allChips = e.sessions.session_entries.map(x => x.chips)
    return allChips.length > 0 && e.chips === Math.max(...allChips)
  }).length

  return (
    <>
      <div className="mb-6">
        <Link href="/" className="text-muted text-xs hover:text-white tracking-widest">← LEADERBOARD</Link>
      </div>
      <PlayerStatsChart
        id={id}
        initialName={player?.name ?? ''}
        data={history}
        totalCny={totalCny}
        totalChips={totalChips}
        sessions={sessionsSorted.length}
        wins={wins}
        pogCount={pogCount}
      />

      <p className="text-xs text-muted tracking-widest mb-4">SESSION HISTORY</p>
      <PlayerSessionHistoryTable rows={[...history].reverse()} />
    </>
  )
}
