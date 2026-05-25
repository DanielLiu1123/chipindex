import Link from 'next/link'
import { db } from '@/lib/db'
import SessionEntriesTable from '@/components/SessionEntriesTable'

export const dynamic = 'force-dynamic'

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: session } = await db
    .from('sessions')
    .select('*, session_entries(*, players(*))')
    .eq('id', id)
    .single()

  const entries = [...(session?.session_entries ?? [])].sort((a: any, b: any) => b.chips - a.chips)
  const total = entries.reduce((s: number, e: any) => s + e.chips, 0)

  return (
    <>
      <div className="mb-6">
        <Link href="/sessions" className="text-muted text-xs hover:text-white tracking-widest">← SESSIONS</Link>
      </div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-white">{session?.date}</h1>
        <Link href={`/sessions/${id}/edit`} className="text-xs text-accent tracking-widest border border-accent/50 hover:border-accent px-2.5 py-1 transition-colors">EDIT</Link>
      </div>
      <div className="mb-2">
        <span className="text-xs text-muted">
          {session?.exchange_rate} chips = 1 CNY
        </span>
      </div>
      <div className="mb-6">
        {session?.description && <p className="text-sm text-muted mt-1">{session.description}</p>}
      </div>
      <SessionEntriesTable entries={entries} exchangeRate={session!.exchange_rate} total={total} />
    </>
  )
}
