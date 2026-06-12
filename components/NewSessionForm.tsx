'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PlayerRowPicker from '@/components/PlayerRowPicker'
import SessionMetaFields from '@/components/SessionMetaFields'
import { usePlayerRows, resolvePlayerId, type PlayerRowBase } from '@/hooks/usePlayerRows'
import { api } from '@/lib/client'
import { BUY_IN_UNIT } from '@/lib/synth'
import { uid } from '@/lib/uid'

interface PlayerRow extends PlayerRowBase { buyin: string }

function newRow(): PlayerRow {
  return { uid: uid(), playerId: '', buyin: String(BUY_IN_UNIT), isNew: false, newName: '' }
}

export default function NewSessionForm() {
  const router = useRouter()
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [exchangeRate, setExchangeRate] = useState('40')
  const [description, setDescription] = useState('')
  const { rows, setRows, updateRow, removeRow, usedIds, players, playersLoading, playersError } = usePlayerRows<PlayerRow>([newRow()])
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const validRows = rows.filter(r => (r.playerId || r.newName.trim()) && r.buyin !== '' && Number(r.buyin) >= 0)

  async function handleStart(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (validRows.length === 0) { setError('Add at least one player.'); return }
    setStarting(true)
    try {
      const playersPayload = await Promise.all(validRows.map(async row => ({
        player_id: await resolvePlayerId(row),
        initial_buyin: Number(row.buyin),
      })))
      const session = await api<{ id: string }>('POST', '/api/sessions', {
        status: 'OPEN',
        date,
        exchange_rate: exchangeRate ? Number(exchangeRate) : 40,
        description: description || null,
        players: playersPayload,
      })
      router.push(`/sessions/${session.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session')
      setStarting(false)
    }
  }

  if (playersLoading) return <p className="text-muted text-xs tracking-widest">LOADING...</p>
  if (playersError) return <p className="text-danger text-xs tracking-widest">{playersError}</p>

  return (
    <>
      <div className="mb-6">
        <Link href="/sessions" className="text-muted text-xs hover:text-white tracking-widest">← SESSIONS</Link>
      </div>
      <h1 className="text-xs text-muted tracking-widest mb-6">NEW SESSION</h1>
      <form onSubmit={handleStart} className="flex flex-col gap-6 max-w-lg">
        <SessionMetaFields
          date={date} setDate={setDate}
          exchangeRate={exchangeRate} setExchangeRate={setExchangeRate}
          description={description} setDescription={setDescription}
        />
        <div>
          <label className="text-xs text-muted tracking-widest block mb-3">PLAYERS <span className="text-muted">(buy-in)</span></label>
          <div className="flex flex-col gap-2">
            {rows.map(row => (
              <div key={row.uid} className="flex gap-2 items-center">
                <PlayerRowPicker row={row} players={players} usedIds={usedIds}
                  onPatch={patch => updateRow(row.uid, patch)} />
                <input type="number" value={row.buyin} onChange={e => updateRow(row.uid, { buyin: e.target.value })}
                  placeholder="buy-in" min="0"
                  className="w-28 bg-surface border border-border text-white text-sm px-4 py-2.5 outline-none focus:border-white transition-colors placeholder:text-muted text-right" />
                <button type="button" onClick={() => removeRow(row.uid)}
                  className="text-muted hover:text-danger text-xs px-2 py-2.5 transition-colors">✕</button>
              </div>
            ))}
            <button type="button" onClick={() => setRows(r => [...r, newRow()])}
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
