'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import PlayerRowPicker from '@/components/PlayerRowPicker'
import SessionMetaFields from '@/components/SessionMetaFields'
import { usePlayerRows, resolvePlayerId, type PlayerRowBase } from '@/hooks/usePlayerRows'
import { importSession } from '@/lib/client'
import { uid } from '@/lib/uid'

interface EntryRow extends PlayerRowBase { chips: string }

function newRow(): EntryRow {
  return { uid: uid(), playerId: '', chips: '', isNew: false, newName: '' }
}

// Import a finished session: record only each player's net result chips (the server uses synthFromNet to build buy_in + final_chips)
export default function SessionForm({ groupId }: { groupId: string }) {
  const router = useRouter()
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [exchangeRate, setExchangeRate] = useState('40')
  const [description, setDescription] = useState('')
  const { rows, setRows, updateRow, removeRow, usedIds, players, playersLoading, playersError } = usePlayerRows<EntryRow>(groupId, [newRow()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const valid = rows.filter(r => (r.playerId || r.newName.trim()) && r.chips !== '')
    if (!valid.length) { setError('Add at least one player entry.'); return }
    setSubmitting(true)
    try {
      const entries = await Promise.all(valid.map(async row => ({
        player_id: await resolvePlayerId(groupId, row),
        chips: Number(row.chips),
      })))
      await importSession(groupId, {
        status: 'SETTLED',
        date,
        exchange_rate: exchangeRate ? Number(exchangeRate) : 40,
        description: description || null,
        entries,
      })
      router.push(`/groups/${groupId}/sessions`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (playersLoading) return <p className="text-muted text-xs tracking-widest">LOADING...</p>
  if (playersError) return <p className="text-danger text-xs tracking-widest">{playersError}</p>

  return (
    <>
      <div className="mb-6">
        <Link href={`/groups/${groupId}/sessions`} className="inline-flex min-h-11 items-center text-xs tracking-widest text-muted hover:text-white sm:min-h-0">← SESSIONS</Link>
      </div>
      <h1 className="text-xs text-muted tracking-widest mb-6">IMPORT SESSION</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-lg">
        <SessionMetaFields
          date={date} setDate={setDate}
          exchangeRate={exchangeRate} setExchangeRate={setExchangeRate}
          description={description} setDescription={setDescription}
        />
        <div>
          <label className="text-xs text-muted tracking-widest block mb-3">PLAYERS</label>
          <div className="flex flex-col gap-2">
            {rows.map(row => (
              <div key={row.uid} className="grid grid-cols-[minmax(0,1fr)_6rem_2.75rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_2rem]">
                <PlayerRowPicker row={row} players={players} usedIds={usedIds}
                  onPatch={patch => updateRow(row.uid, patch)} />
                <input type="number" value={row.chips} onChange={e => updateRow(row.uid, { chips: e.target.value })}
                  placeholder="chips (±)"
                  className="w-full border border-border bg-surface px-2 py-2.5 text-right text-sm text-white outline-none transition-colors placeholder:text-muted focus:border-white sm:px-4" />
                <button type="button" onClick={() => removeRow(row.uid)}
                  className="flex h-11 w-11 items-center justify-center text-xs text-muted transition-colors hover:text-danger sm:h-8 sm:w-8">✕</button>
              </div>
            ))}
            <button type="button" onClick={() => setRows(r => [...r, newRow()])}
              className="text-xs text-muted hover:text-white tracking-widest text-left py-2 transition-colors">
              + ADD PLAYER
            </button>
          </div>
        </div>
        {error && <p className="text-danger text-xs">{error}</p>}
        <button type="submit" disabled={submitting}
          className="bg-white text-bg text-xs font-medium tracking-widest py-3 hover:bg-accent transition-colors disabled:opacity-40">
          {submitting ? 'IMPORTING...' : 'IMPORT'}
        </button>
      </form>
    </>
  )
}
