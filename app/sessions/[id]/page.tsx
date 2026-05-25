import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import SessionEntriesTable from '@/components/SessionEntriesTable'

export const dynamic = 'force-dynamic'

interface SessionEntry {
  id: string
  player_id: string
  chips: number
  players: { name: string } | null
}

interface Session {
  id: string
  date: string
  description: string | null
  exchange_rate: number
  session_entries: SessionEntry[]
}

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: session } = await db
    .from('sessions')
    .select('*, session_entries(*, players(*))')
    .eq('id', id)
    .single()

  if (!session) notFound()

  const typed = session as unknown as Session
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
