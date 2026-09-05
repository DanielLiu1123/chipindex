'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PlayerSelectionModal from '@/components/PlayerSelectionModal'
import PlayerActionButton from '@/components/PlayerActionButton'
import SessionMetaFields from '@/components/SessionMetaFields'
import { startSession } from '@/lib/client'
import { usePlayerDirectory } from '@/lib/use-player-directory'
import { MAX_BUY_IN_AMOUNT, parseBuyInAmount } from '@/lib/buy-in-policy'
import type { Player } from '@/lib/domain-types'
import { BUY_IN_UNIT } from '@/lib/synth'

interface PlayerRow { playerId: string; buyin: string }

export default function NewSessionForm({ groupId, initialPlayers }: { groupId: string; initialPlayers: Player[] }) {
  const router = useRouter()
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [exchangeRate, setExchangeRate] = useState('40')
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState<PlayerRow[]>([])
  const [addPlayersOpen, setAddPlayersOpen] = useState(false)
  const startBusy = useRef(false)
  const directory = usePlayerDirectory({ groupId, players: initialPlayers, excludedIds: rows.map(row => row.playerId), excludedMessage: 'This player is already selected.' })
  const updateBuyIn = (playerId: string, buyin: string) => setRows(current => current.map(row => row.playerId === playerId ? { ...row, buyin } : row))
  const removeRow = (playerId: string) => setRows(current => current.filter(row => row.playerId !== playerId))
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')

  const validRows = rows.filter(row => parseBuyInAmount(row.buyin) !== null)

  async function handleStart(e: React.FormEvent) {
    e.preventDefault()
    if (startBusy.current) return
    setError('')
    if (validRows.length === 0) { setError('Add at least one player.'); return }
    if (validRows.length !== rows.length) { setError('Every player needs a positive integer buy-in.'); return }
    startBusy.current = true
    setStarting(true)
    try {
      const playersPayload = validRows.map(row => ({
        player_id: row.playerId,
        initial_buyin: Number(row.buyin),
      }))
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
      startBusy.current = false
    }
  }

  return (
    <>
      <PlayerSelectionModal open={addPlayersOpen} participants={directory.participants}
        onCreatePlayer={directory.create} onClose={() => setAddPlayersOpen(false)}
        action={{ kind: 'draft', unit: BUY_IN_UNIT, submit: (ids, amount) => setRows(current => [...current,
          ...ids.filter(id => !current.some(row => row.playerId === id)).map(playerId => ({ playerId, buyin: String(amount) })),
        ]) }} />
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
              const playerName = directory.players.find(player => player.id === row.playerId)?.name
              const accessibleName = playerName ?? row.playerId
              return <div key={row.playerId}
                className="group flex gap-2 items-center border border-border bg-surface/30 px-3 py-1.5 transition-colors hover:border-white/30">
                  <span className="flex-1 min-w-0 text-white text-sm px-1 truncate">
                    {playerName ?? row.playerId}
                  </span>
                <input type="number" value={row.buyin} disabled={starting} onChange={e => updateBuyIn(row.playerId, e.target.value)}
                  aria-label={`buy-in for ${accessibleName}`}
                  placeholder="buy-in" min="1" max={MAX_BUY_IN_AMOUNT} step="1"
                  className="w-28 shrink-0 bg-bg/40 border border-border text-white text-sm px-3 py-1.5 outline-none focus:border-white transition-colors placeholder:text-muted text-right" />
                <button type="button" disabled={starting} onClick={() => removeRow(row.playerId)}
                  aria-label={`remove ${accessibleName}`}
                  className="w-8 h-8 shrink-0 flex items-center justify-center border border-transparent text-muted hover:text-danger hover:border-danger/40 hover:bg-danger/10 text-lg leading-none transition-colors">×</button>
              </div>
            })}
            <PlayerActionButton action="add-player" disabled={starting} onClick={() => setAddPlayersOpen(true)} />
          </div>
        </div>
        {error && <p className="text-danger text-xs">{error}</p>}
        <button type="submit" disabled={starting || validRows.length === 0 || validRows.length !== rows.length}
          className="flex items-center justify-center gap-2 bg-white text-bg text-xs font-medium tracking-widest py-3 hover:bg-accent transition-colors disabled:opacity-40">
          <span className="inline-block w-2 h-2 rounded-full bg-accent" />
          {starting ? 'STARTING...' : 'START'}
        </button>
      </form>
    </>
  )
}
