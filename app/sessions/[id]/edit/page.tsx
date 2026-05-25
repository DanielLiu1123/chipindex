'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import type { Player } from '@/types'

interface EntryRow { playerId: string; chips: string; isNew: boolean; newName: string }

export default function EditSessionPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [date, setDate] = useState('')
  const [exchangeRate, setExchangeRate] = useState('')
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState<EntryRow[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/players').then(r => r.json()),
      fetch(`/api/sessions/${id}`).then(r => r.json()),
    ]).then(([ps, session]) => {
      setPlayers(ps)
      setDate(session.date ?? '')
      setExchangeRate(session.exchange_rate ? String(session.exchange_rate) : '')
      setDescription(session.description ?? '')
      setRows((session.session_entries ?? []).map((e: any) => ({
        playerId: e.player_id,
        chips: String(e.chips),
        isNew: false,
        newName: '',
      })))
      setLoading(false)
    })
  }, [id])

  const updateRow = (i: number, patch: Partial<EntryRow>) =>
    setRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const valid = rows.filter(r => (r.playerId || r.newName.trim()) && r.chips !== '')
    if (!valid.length) { setError('Add at least one player entry.'); return }
    setSubmitting(true)
    try {
      const entries = await Promise.all(valid.map(async row => {
        let player_id = row.playerId
        if (row.isNew && row.newName.trim()) {
          const res = await fetch('/api/players', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: row.newName.trim() }),
          })
          const p = await res.json()
          player_id = p.id
        }
        return { player_id, chips: Number(row.chips) }
      }))
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, exchange_rate: exchangeRate ? Number(exchangeRate) : null, description: description || null, entries }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Save failed')
      }
      router.push(`/sessions/${id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const usedIds = rows.map(r => r.playerId).filter(Boolean)

  if (loading) return <p className="text-muted text-xs tracking-widest">LOADING...</p>

  return (
    <>
      <div className="mb-6">
        <Link href={`/sessions/${id}`} className="text-muted text-xs hover:text-white tracking-widest">← SESSION</Link>
      </div>
      <h1 className="text-xs text-muted tracking-widest mb-6">EDIT SESSION</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-lg">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs text-muted tracking-widest block mb-2">DATE</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="w-full bg-surface border border-border text-white text-sm px-4 py-3 outline-none focus:border-white transition-colors" />
          </div>
          <div className="w-32">
            <label className="text-xs text-muted tracking-widest block mb-2">RATE <span className="text-muted">(opt)</span></label>
            <input type="number" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} placeholder="40" min="1"
              className="w-full bg-surface border border-border text-white text-sm px-4 py-3 outline-none focus:border-white transition-colors placeholder:text-muted" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted tracking-widest block mb-2">DESCRIPTION <span className="text-muted">(opt)</span></label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. 周五局"
            className="w-full bg-surface border border-border text-white text-sm px-4 py-3 outline-none focus:border-white transition-colors placeholder:text-muted" />
        </div>
        <div>
          <label className="text-xs text-muted tracking-widest block mb-3">PLAYERS</label>
          <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                {row.isNew ? (
                  <input type="text" value={row.newName} onChange={e => updateRow(i, { newName: e.target.value })}
                    placeholder="new player name"
                    className="flex-1 bg-surface border border-accent text-white text-sm px-4 py-2.5 outline-none focus:border-white transition-colors placeholder:text-muted" />
                ) : (
                  <select value={row.playerId}
                    onChange={e => e.target.value === '__new__'
                      ? updateRow(i, { isNew: true, playerId: '', newName: '' })
                      : updateRow(i, { playerId: e.target.value })}
                    className="flex-1 bg-surface border border-border text-white text-sm px-4 py-2.5 outline-none focus:border-white transition-colors">
                    <option value="">select player</option>
                    {players.filter(p => !usedIds.includes(p.id) || p.id === row.playerId)
                      .map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    <option value="__new__">+ new player</option>
                  </select>
                )}
                <input type="number" value={row.chips} onChange={e => updateRow(i, { chips: e.target.value })}
                  placeholder="chips (±)"
                  className="w-28 bg-surface border border-border text-white text-sm px-4 py-2.5 outline-none focus:border-white transition-colors placeholder:text-muted" />
                <button type="button" onClick={() => setRows(r => r.filter((_, idx) => idx !== i))}
                  className="text-muted hover:text-danger text-xs px-2 py-2.5 transition-colors">✕</button>
              </div>
            ))}
            <button type="button" onClick={() => setRows(r => [...r, { playerId: '', chips: '', isNew: false, newName: '' }])}
              className="text-xs text-muted hover:text-white tracking-widest text-left py-2 transition-colors">
              + ADD PLAYER
            </button>
          </div>
        </div>
        {error && <p className="text-danger text-xs">{error}</p>}
        <button type="submit" disabled={submitting}
          className="bg-white text-bg text-xs font-medium tracking-widest py-3 hover:bg-accent transition-colors disabled:opacity-40">
          {submitting ? 'SAVING...' : 'SAVE CHANGES'}
        </button>
      </form>
    </>
  )
}
