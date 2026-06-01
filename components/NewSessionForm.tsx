'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Player } from '@/types'
import PlayerSelect from '@/components/PlayerSelect'
import { BUY_IN_UNIT } from '@/lib/synth'
import { uid } from '@/lib/uid'

interface PlayerRow { uid: string; playerId: string; buyin: string; isNew: boolean; newName: string }

function newRow(buyin: string): PlayerRow {
  return { uid: uid(), playerId: '', buyin, isNew: false, newName: '' }
}

export default function NewSessionForm() {
  const router = useRouter()
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [exchangeRate, setExchangeRate] = useState('40')
  const [buyInUnit, setBuyInUnit] = useState(String(BUY_IN_UNIT))
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState<PlayerRow[]>(() => [newRow(String(BUY_IN_UNIT))])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/players')
      .then(r => r.json())
      .then((ps: Player[]) => { setPlayers(ps); setLoading(false) })
      .catch(() => { setLoadError('Failed to load players.'); setLoading(false) })
  }, [])

  const updateRow = (uid: string, patch: Partial<PlayerRow>) =>
    setRows(r => r.map(row => row.uid === uid ? { ...row, ...patch } : row))

  const usedIds = rows.map(r => r.playerId).filter(Boolean)
  const validRows = rows.filter(r => (r.playerId || r.newName.trim()) && r.buyin !== '' && Number(r.buyin) >= 0)

  async function handleStart(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (validRows.length === 0) { setError('Add at least one player.'); return }
    setStarting(true)
    try {
      const playersPayload = await Promise.all(validRows.map(async row => {
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
        return { player_id, initial_buyin: Number(row.buyin) }
      }))

      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'OPEN',
          date,
          exchange_rate: exchangeRate ? Number(exchangeRate) : 40,
          buy_in_unit: buyInUnit ? Number(buyInUnit) : BUY_IN_UNIT,
          description: description || null,
          players: playersPayload,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to start session')
      const session = await res.json()
      router.push(`/sessions/${session.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session')
      setStarting(false)
    }
  }

  if (loading) return <p className="text-muted text-xs tracking-widest">LOADING...</p>
  if (loadError) return <p className="text-danger text-xs tracking-widest">{loadError}</p>

  return (
    <>
      <div className="mb-6">
        <Link href="/sessions" className="text-muted text-xs hover:text-white tracking-widest">← SESSIONS</Link>
      </div>
      <h1 className="text-xs text-muted tracking-widest mb-6">NEW SESSION</h1>
      <form onSubmit={handleStart} className="flex flex-col gap-6 max-w-lg">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs text-muted tracking-widest block mb-2">DATE</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="w-full bg-surface border border-border text-white text-sm px-4 py-3 outline-none focus:border-white transition-colors" />
          </div>
          <div className="w-28">
            <label className="text-xs text-muted tracking-widest block mb-2">RATE <span className="text-muted">(opt)</span></label>
            <input type="number" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} placeholder="40" min="1"
              className="w-full bg-surface border border-border text-white text-sm px-4 py-3 outline-none focus:border-white transition-colors placeholder:text-muted" />
          </div>
          <div className="w-28">
            <label className="text-xs text-muted tracking-widest block mb-2">UNIT</label>
            <input type="number" value={buyInUnit} onChange={e => setBuyInUnit(e.target.value)} placeholder={String(BUY_IN_UNIT)} min="1"
              className="w-full bg-surface border border-border text-white text-sm px-4 py-3 outline-none focus:border-white transition-colors placeholder:text-muted" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted tracking-widest block mb-2">DESCRIPTION <span className="text-muted">(opt)</span></label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Friday game"
            className="w-full bg-surface border border-border text-white text-sm px-4 py-3 outline-none focus:border-white transition-colors placeholder:text-muted" />
        </div>
        <div>
          <label className="text-xs text-muted tracking-widest block mb-3">PLAYERS <span className="text-muted">(buy-in)</span></label>
          <div className="flex flex-col gap-2">
            {rows.map(row => (
              <div key={row.uid} className="flex gap-2 items-center">
                {row.isNew ? (
                  <input type="text" value={row.newName} onChange={e => updateRow(row.uid, { newName: e.target.value })}
                    placeholder="new player name"
                    className="flex-1 bg-surface border border-accent text-white text-sm px-4 py-2.5 outline-none focus:border-white transition-colors placeholder:text-muted" />
                ) : (
                  <PlayerSelect
                    value={row.playerId}
                    players={players.filter(p => !usedIds.includes(p.id) || p.id === row.playerId)}
                    onChange={val => val === '__new__'
                      ? updateRow(row.uid, { isNew: true, playerId: '', newName: '' })
                      : updateRow(row.uid, { playerId: val })}
                    className="flex-1"
                  />
                )}
                <input type="number" value={row.buyin} onChange={e => updateRow(row.uid, { buyin: e.target.value })}
                  placeholder="buy-in" min="0"
                  className="w-28 bg-surface border border-border text-white text-sm px-4 py-2.5 outline-none focus:border-white transition-colors placeholder:text-muted text-right" />
                <button type="button" onClick={() => setRows(r => r.filter(x => x.uid !== row.uid))}
                  className="text-muted hover:text-danger text-xs px-2 py-2.5 transition-colors">✕</button>
              </div>
            ))}
            <button type="button" onClick={() => setRows(r => [...r, newRow(buyInUnit)])}
              className="text-xs text-muted hover:text-white tracking-widest text-left py-2 transition-colors">
              + ADD PLAYER
            </button>
          </div>
        </div>
        {error && <p className="text-danger text-xs">{error}</p>}
        <button type="submit" disabled={starting || validRows.length === 0}
          className="flex items-center justify-center gap-2 bg-white text-bg text-xs font-medium tracking-widest py-3 hover:bg-accent transition-colors disabled:opacity-40">
          <span className="inline-block w-2 h-2 rounded-full bg-accent" />
          {starting ? 'STARTING...' : 'START'}
        </button>
      </form>
    </>
  )
}
