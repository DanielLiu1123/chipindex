'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PlayerSelectionModal from './PlayerSelectionModal'
import PlayerActionButton from './PlayerActionButton'
import SessionMetaFields from './SessionMetaFields'
import { usePlayerDirectory } from '@/lib/use-player-directory'
import { importSession } from '@/lib/client'
import { errorMessage } from '@/lib/error-message'
import { localDate } from '@/lib/browser-time'
import { DEFAULT_EXCHANGE_RATE } from '@/lib/session-rules'
import type { Player } from '@/lib/domain-types'

interface EntryRow { playerId: string; chips: string }

export default function SessionForm({ groupId, initialPlayers }: { groupId: string; initialPlayers: Player[] }) {
  const router = useRouter()
  const [date, setDate] = useState('')
  useEffect(() => { setDate(localDate()) }, [])
  const [exchangeRate, setExchangeRate] = useState(String(DEFAULT_EXCHANGE_RATE))
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState<EntryRow[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const busy = useRef(false)
  const directory = usePlayerDirectory({ groupId, players: initialPlayers,
    excludedIds: rows.map(row => row.playerId), excludedMessage: 'This player is already selected.' })

  async function selectPlayers(ids: string[]) {
    setRows(current => [...current, ...[...new Set(ids)]
      .filter(id => !current.some(row => row.playerId === id)).map(playerId => ({ playerId, chips: '' }))])
  }
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (busy.current) return
    setError('')
    if (!rows.length) { setError('Add at least one player.'); return }
    if (rows.some(row => !row.chips.trim() || !Number.isSafeInteger(Number(row.chips)))) {
      setError('Enter integer net chips for every player.'); return
    }
    busy.current = true; setSubmitting(true)
    try {
      await importSession(groupId, { status: 'SETTLED', date,
        exchange_rate: exchangeRate ? Number(exchangeRate) : DEFAULT_EXCHANGE_RATE,
        description: description || null,
        entries: rows.map(row => ({ player_id: row.playerId, chips: Number(row.chips) })),
      })
      router.push(`/groups/${groupId}/sessions`); router.refresh()
    } catch (reason) { setError(errorMessage(reason)) }
    finally { busy.current = false; setSubmitting(false) }
  }
  return <>
    <PlayerSelectionModal open={pickerOpen} participants={directory.participants}
      action={{ kind: 'players', submit: selectPlayers }} onCreatePlayer={directory.create} onClose={() => setPickerOpen(false)} />
    <div className="mb-6"><Link href={`/groups/${groupId}/sessions`} className="text-xs tracking-widest text-muted hover:text-white">← SESSIONS</Link></div>
    <h1 className="mb-6 text-xs tracking-widest text-muted">IMPORT SESSION</h1>
    <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-6">
      <SessionMetaFields date={date} setDate={setDate} exchangeRate={exchangeRate} setExchangeRate={setExchangeRate}
        description={description} setDescription={setDescription} disabled={submitting} />
      <div className="flex flex-col gap-2">
        {rows.map(row => {
          const name = directory.players.find(player => player.id === row.playerId)?.name ?? row.playerId
          return <div key={row.playerId} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm text-white">{name}</span>
            <input aria-label={`net chips for ${name}`} type="number" step="1" required value={row.chips} disabled={submitting}
              onChange={event => setRows(current => current.map(item => item.playerId === row.playerId ? { ...item, chips: event.target.value } : item))}
              placeholder="chips (±)" className="w-28 border border-border bg-surface px-3 py-2.5 text-sm text-white" />
            <button type="button" aria-label={`remove ${name}`} disabled={submitting}
              onClick={() => setRows(current => current.filter(item => item.playerId !== row.playerId))}
              className="px-2 py-2.5 text-xs text-muted hover:text-danger">✕</button>
          </div>
        })}
        <PlayerActionButton action="add-player" disabled={submitting} onClick={() => setPickerOpen(true)} />
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <button type="submit" disabled={submitting || !date} className="bg-white py-3 text-xs tracking-widest text-bg hover:bg-accent disabled:opacity-40">{submitting ? 'IMPORTING...' : 'IMPORT'}</button>
    </form>
  </>
}
