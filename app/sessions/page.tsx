'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface SessionEntry {
  chips: number
  player_id: string
  players: { name: string } | null
}

interface Session {
  id: string
  date: string
  description: string | null
  exchange_rate: number
  session_entries: SessionEntry[]
}

function getWinner(entries: SessionEntry[]): { name: string; player_id: string } | null {
  if (!entries || entries.length === 0) return null
  const top = entries.reduce((best, e) => e.chips > best.chips ? e : best, entries[0])
  return top.players ? { name: top.players.name, player_id: top.player_id } : null
}

export default function SessionsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])

  useEffect(() => {
    fetchSessions()
  }, [])

  async function fetchSessions() {
    const res = await fetch('/api/sessions')
    const data = await res.json()
    setSessions(data ?? [])
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this session?')) return
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' })
    setSessions(s => s.filter(session => session.id !== id))
  }

  return (
    <>
      <div className="flex items-baseline justify-end mb-6">
        <Link href="/sessions/new" className="text-xs text-accent tracking-widest hover:underline">+ NEW SESSION</Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted text-xs tracking-widest">
            <th className="text-left py-3 font-normal">DATE</th>
            <th className="text-right py-3 font-normal">PLAYERS</th>
            <th className="text-right py-3 font-normal">WINNER</th>
            <th className="text-right py-3 font-normal">RATE</th>
            <th className="text-right py-3 font-normal"></th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} onClick={() => router.push(`/sessions/${s.id}`)}
              className="border-b border-border hover:bg-surface transition-colors cursor-pointer">
              <td className="py-4">
                <div>{s.date}</div>
                {s.description && <div className="text-xs text-muted mt-0.5">{s.description}</div>}
              </td>
              <td className="py-4 text-right text-muted">{s.session_entries?.length ?? 0}</td>
              <td className="py-4 text-right">
                {(() => {
                  const w = getWinner(s.session_entries)
                  return w
                    ? <Link href={`/players/${w.player_id}`} onClick={e => e.stopPropagation()} className="text-muted hover:text-accent transition-colors">{w.name}</Link>
                    : <span className="text-muted">—</span>
                })()}
              </td>
              <td className="py-4 text-right text-muted">{s.exchange_rate ? `${s.exchange_rate}:1` : '—'}</td>
              <td className="py-4 text-right">
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(s.id) }}
                  className="text-xs font-medium tracking-widest text-red-500 hover:text-red-400 border border-red-500/40 hover:border-red-400 px-2.5 py-1 transition-colors">
                  DELETE
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
