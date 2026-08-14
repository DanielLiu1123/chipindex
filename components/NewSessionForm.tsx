'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PlayerMultiSelect from '@/components/PlayerMultiSelect'
import SessionMetaFields from '@/components/SessionMetaFields'
import { usePlayerRows, resolvePlayerId, type PlayerRowBase } from '@/hooks/usePlayerRows'
import { api } from '@/lib/client'
import { BUY_IN_UNIT } from '@/lib/synth'
import { uid } from '@/lib/uid'

interface PlayerRow extends PlayerRowBase { buyin: string }

function existingPlayerRow(playerId: string): PlayerRow {
  return { uid: uid(), playerId, buyin: String(BUY_IN_UNIT), isNew: false, newName: '' }
}

function newPlayerRow(): PlayerRow {
  return { uid: uid(), playerId: '', buyin: String(BUY_IN_UNIT), isNew: true, newName: '' }
}

export default function NewSessionForm({ groupId }: { groupId: string }) {
  const router = useRouter()
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [exchangeRate, setExchangeRate] = useState('40')
  const [description, setDescription] = useState('')
  const { rows, setRows, updateRow, removeRow, usedIds, players, playersLoading, playersError } = usePlayerRows<PlayerRow>(groupId, [])
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
        player_id: await resolvePlayerId(groupId, row),
        initial_buyin: Number(row.buyin),
      })))
      const session = await api<{ id: string }>('POST', `/api/groups/${groupId}/sessions`, {
        status: 'OPEN',
        date,
        exchange_rate: exchangeRate ? Number(exchangeRate) : 40,
        description: description || null,
        players: playersPayload,
      })
      router.push(`/groups/${groupId}/sessions/${session.id}`)
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
        <Link href={`/groups/${groupId}/sessions`} className="text-muted text-xs hover:text-white tracking-widest">← SESSIONS</Link>
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
          <div className="flex flex-col gap-1.5">
            {rows.map(row => {
              const playerName = players.find(player => player.id === row.playerId)?.name
              const accessibleName = (playerName ?? row.newName) || 'new player'
              return <div key={row.uid}
                className={`group flex gap-2 items-center border bg-surface/30 px-3 py-1.5 transition-colors hover:border-white/30 ${row.isNew ? 'border-accent/50' : 'border-border'}`}>
                {row.isNew ? (
                  <input type="text" value={row.newName} onChange={e => updateRow(row.uid, { newName: e.target.value })}
                    placeholder="new player name"
                    className="flex-1 min-w-0 bg-transparent border-b border-accent text-white text-sm px-1 py-1.5 outline-none focus:border-white transition-colors placeholder:text-muted" />
                ) : (
                  <span className="flex-1 min-w-0 text-white text-sm px-1 truncate">
                    {playerName ?? row.playerId}
                  </span>
                )}
                <input type="number" value={row.buyin} onChange={e => updateRow(row.uid, { buyin: e.target.value })}
                  aria-label={`buy-in for ${accessibleName}`}
                  placeholder="buy-in" min="0"
                  className="w-28 shrink-0 bg-bg/40 border border-border text-white text-sm px-3 py-1.5 outline-none focus:border-white transition-colors placeholder:text-muted text-right" />
                <button type="button" onClick={() => removeRow(row.uid)}
                  aria-label={`remove ${accessibleName}`}
                  className="w-8 h-8 shrink-0 flex items-center justify-center border border-transparent text-muted hover:text-danger hover:border-danger/40 hover:bg-danger/10 text-lg leading-none transition-colors">×</button>
              </div>
            })}
            <PlayerMultiSelect
              players={players}
              excludedIds={usedIds}
              onAdd={ids => setRows(current => [...current, ...ids.map(existingPlayerRow)])}
              onNew={() => setRows(current => [...current, newPlayerRow()])}
            />
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
