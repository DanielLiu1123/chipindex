'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PlayerMultiSelect from '@/components/PlayerMultiSelect'
import SessionMetaFields from '@/components/SessionMetaFields'
import { usePlayerRows, resolvePlayerId, type PlayerRowBase } from '@/hooks/usePlayerRows'
import { startSession } from '@/lib/client'
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
      const session = await startSession(groupId, {
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
        <Link href={`/groups/${groupId}/sessions`} className="inline-flex min-h-11 items-center text-xs tracking-widest text-muted hover:text-white sm:min-h-0">← SESSIONS</Link>
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
                className={`group grid grid-cols-[minmax(0,1fr)_6rem_2.75rem] items-center gap-2 border bg-surface/30 px-3 py-1.5 transition-colors hover:border-white/30 sm:grid-cols-[minmax(0,1fr)_7rem_2rem] ${row.isNew ? 'border-accent/50' : 'border-border'}`}>
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
                  className="w-full shrink-0 border border-border bg-bg/40 px-2 py-1.5 text-right text-sm text-white outline-none transition-colors placeholder:text-muted focus:border-white sm:px-3" />
                <button type="button" onClick={() => removeRow(row.uid)}
                  aria-label={`remove ${accessibleName}`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center border border-transparent text-lg leading-none text-muted transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger sm:h-8 sm:w-8">×</button>
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
