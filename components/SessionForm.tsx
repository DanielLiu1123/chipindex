'use client'

import DeleteIconButton from '@/components/DeleteIconButton'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import PlayerSelectionModal from './PlayerSelectionModal'
import SessionPlayersHeader from '@/components/SessionPlayersHeader'
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

  const hasPlayers = rows.length > 0

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
    <h1 className="mb-6 text-2xl font-medium tracking-tight">IMPORT SESSION</h1>
    <form onSubmit={handleSubmit} className="surface flex max-w-lg flex-col gap-6">
      <SessionMetaFields date={date} setDate={setDate} exchangeRate={exchangeRate} setExchangeRate={setExchangeRate}
        description={description} setDescription={setDescription} disabled={submitting} />
      <div>
        <SessionPlayersHeader disabled={submitting} onAdd={() => setPickerOpen(true)} />
        {!hasPlayers ? (
          <p className="rounded-lg border border-dashed border-input px-3 py-6 text-center text-sm text-muted-foreground">No players</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {rows.map(row => {
              const name = directory.players.find(player => player.id === row.playerId)?.name ?? row.playerId
              return <div key={row.playerId} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{name}</span>
                <Input aria-label={`net chips for ${name}`} type="number" step="1" required value={row.chips} disabled={submitting}
                  onChange={event => setRows(current => current.map(item => item.playerId === row.playerId ? { ...item, chips: event.target.value } : item))}
                  placeholder="chips (±)" className="w-28 shrink-0 text-right" />
                <DeleteIconButton label={`remove ${name}`} disabled={submitting}
                  onClick={() => setRows(current => current.filter(item => item.playerId !== row.playerId))} />
              </div>
            })}
          </div>
        )}
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="flex flex-col gap-2">
        <Button variant="default" type="submit" disabled={submitting || !date || !hasPlayers} className="w-full">{submitting ? 'IMPORTING...' : 'IMPORT'}</Button>
        {!hasPlayers && <p className="text-xs text-muted-foreground">Add at least one player to import.</p>}
      </div>
    </form>
  </>
}
