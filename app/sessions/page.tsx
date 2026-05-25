'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Session {
  id: string
  date: string
  exchange_rate: number | null
  session_entries: { count: number }[]
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
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-xs text-muted tracking-widest">SESSIONS</h1>
        <Link href="/sessions/new" className="text-xs text-accent tracking-widest hover:underline">+ NEW SESSION</Link>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted text-xs tracking-widest">
            <th className="text-left py-3 font-normal">DATE</th>
            <th className="text-right py-3 font-normal">PLAYERS</th>
            <th className="text-right py-3 font-normal">RATE</th>
            <th className="text-right py-3 font-normal"></th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} onClick={() => router.push(`/sessions/${s.id}`)}
              className="border-b border-border hover:bg-surface transition-colors cursor-pointer">
              <td className="py-4">{s.date}</td>
              <td className="py-4 text-right text-muted">{s.session_entries?.[0]?.count ?? 0}</td>
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
