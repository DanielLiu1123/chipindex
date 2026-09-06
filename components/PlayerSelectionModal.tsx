'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { MAX_BUY_IN_AMOUNT } from '@/lib/buy-in-policy'
import { PLAYER_PAGE_SIZE, type SelectablePlayer } from '@/lib/player-selection'
import { usePlayerAction, type PlayerAction } from '@/lib/use-player-action'

interface Props {
  open: boolean
  participants: SelectablePlayer[]
  picker?: 'available' | 'session'
  action: PlayerAction
  onCreatePlayer?: (name: string) => Promise<SelectablePlayer>
  onClose: () => void
}

export default function PlayerSelectionModal({ open, participants, picker = 'available', action, onCreatePlayer, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const busy = useRef(false)
  const id = useId()
  const [selected, setSelected] = useState<string[]>([])
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newError, setNewError] = useState('')
  const [visibleCount, setVisibleCount] = useState(PLAYER_PAGE_SIZE)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    else if (!open && dialog.current?.open) dialog.current.close()
  }, [open])

  const chosen = participants.filter(p => selected.includes(p.player_id) && p.settled_at === null)
  const submission = usePlayerAction(action, chosen)
  const { value, setValue, amount, valid, pending, error, receipt, retrying } = submission
  const locked = creating || submission.locked
  const addingPlayers = picker === 'available'
  const amountId = `${id}-amount`
  const search = query.trim().toLowerCase()
  const visiblePlayers = !addingPlayers ? participants.filter(player => player.settled_at === null) : search
    ? participants.filter(player => player.name.toLowerCase().includes(search))
    : participants.slice(0, visibleCount)

  function close() {
    if (busy.current || submission.isBusy()) return
    if (submission.reset()) {
      setSelected([])
      setAddingNew(false); setNewName(''); setNewError('')
      setVisibleCount(PLAYER_PAGE_SIZE); setQuery('')
    }
    onClose()
  }

  async function createPlayer() {
    const name = newName.trim()
    if (!name || !onCreatePlayer || busy.current || submission.isBusy() || locked) return
    busy.current = true; setCreating(true); setNewError('')
    try {
      const player = await onCreatePlayer(name)
      setSelected(ids => ids.includes(player.player_id) ? ids : [...ids, player.player_id])
      // A matching existing player may be beyond the currently visible page.
      const index = participants.findIndex(p => p.player_id === player.player_id)
      if (index >= visibleCount) setVisibleCount(Math.ceil((index + 1) / PLAYER_PAGE_SIZE) * PLAYER_PAGE_SIZE)
      setAddingNew(false); setNewName(''); setQuery('')
    } catch (e) {
      setNewError(e instanceof Error ? e.message : 'Could not create player.')
    } finally {
      busy.current = false; setCreating(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy.current || (addingNew && newName.trim())) return
    if (await submission.submit()) close()
  }

  return (
    <dialog ref={dialog} aria-label={receipt ? 'Buy-ins recorded' : addingPlayers ? 'Add players' : 'Buy in'}
      onCancel={event => { event.preventDefault(); close() }}
      onClick={event => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right
          || event.clientY < rect.top || event.clientY > rect.bottom) close()
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto border border-border bg-surface p-5 text-white backdrop:bg-black/70">
      {receipt ? (
        <div aria-live="polite">
          <p className="mb-4 text-xs text-accent">✓ Saved. Distribute chips as listed below.</p>
          {receipt.map(row => <div key={row.player_id} className="flex justify-between gap-3 border-b border-border py-3 text-sm">
            <span className="min-w-0 break-words">{row.name}</span><span className="shrink-0 tabular-nums text-accent">+{row.amount.toLocaleString()}</span>
          </div>)}
          <button type="button" onClick={close} className="mt-5 w-full bg-white py-3 text-xs tracking-widest text-bg hover:bg-accent">DONE</button>
        </div>
      ) : (
        // Receive initial dialog focus without adding a Tab stop before search.
        <form tabIndex={addingPlayers ? -1 : undefined} onSubmit={submit}>
          {addingPlayers && <input id={`${id}-search`} type="search" aria-label="Search players" placeholder="Search players..."
            value={query} onChange={event => setQuery(event.target.value)}
            onKeyDown={event => { if (event.key === 'Enter') event.preventDefault() }}
            className="mb-3 w-full border border-border bg-bg px-3 py-2 text-sm text-white placeholder:text-muted focus:border-white" />}
          <div role="group" aria-label={addingPlayers ? 'Available players' : 'Session players'} className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
            {visiblePlayers.map(p => <label key={p.player_id} className={`inline-flex min-h-10 max-w-full items-center gap-2 border px-2.5 py-2 text-xs transition-colors ${p.settled_at !== null ? 'border-border text-muted' : selected.includes(p.player_id) ? 'cursor-pointer border-accent/60 bg-accent/10 text-accent' : 'cursor-pointer border-border hover:border-white/40 hover:bg-white/5'}`}>
              <input type="checkbox" checked={selected.includes(p.player_id)} disabled={locked || p.settled_at !== null}
                onChange={() => setSelected(ids => ids.includes(p.player_id) ? ids.filter(id => id !== p.player_id) : [...ids, p.player_id])}
                className="h-3.5 w-3.5 shrink-0 accent-accent" />
              <span className="min-w-0 break-words">{p.name}</span>
              {p.settled_at !== null && <span className="text-xs text-muted">CASHED OUT</span>}
            </label>)}
            {addingPlayers && !search && visibleCount < participants.length && <button type="button" aria-label="Show 10 more players"
              onClick={() => setVisibleCount(count => count + PLAYER_PAGE_SIZE)}
              className="min-h-10 border border-border px-3 py-2 text-sm text-muted hover:border-white/40 hover:text-white">…</button>}
            {visiblePlayers.length === 0 && <p className="p-4 text-xs text-muted">{addingPlayers ? search ? 'No matching players.' : 'No available players.' : 'No active session players.'}</p>}
          </div>
          {addingPlayers && onCreatePlayer && (
            addingNew ? <div className="mt-3 border border-border p-3">
              <input id={`${id}-name`} type="text" aria-label="New player name" placeholder="Player name" autoFocus value={newName} disabled={locked}
                onChange={event => setNewName(event.target.value)}
                onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void createPlayer() } }}
                className="w-full min-w-0 border border-border bg-bg px-3 py-2 text-sm text-white focus:border-white disabled:opacity-50" />
              {newError && <p role="alert" className="mt-2 text-xs text-danger">{newError}</p>}
              <div className="mt-3 flex justify-end gap-3">
                <button type="button" disabled={locked} onClick={() => { setAddingNew(false); setNewName(''); setNewError('') }}
                  className="px-2 py-2 text-xs text-muted hover:text-white disabled:opacity-40">CANCEL</button>
                <button type="button" disabled={locked || !newName.trim()} onClick={() => { void createPlayer() }}
                  className="border border-accent/40 px-3 py-2 text-xs text-accent hover:border-accent disabled:opacity-40">{creating ? 'CREATING...' : 'CREATE'}</button>
              </div>
            </div> : <button type="button" disabled={locked} onClick={() => { setNewName(query.trim()); setAddingNew(true) }}
              className="mt-3 border border-dashed border-border px-3 py-2 text-xs text-muted hover:border-white/40 hover:text-white disabled:opacity-40">+ NEW PLAYER</button>
          )}
          {action.kind !== 'players' && <><label htmlFor={amountId} className="mb-2 mt-5 block text-xs tracking-widest text-muted">CHIPS PER PLAYER</label>
          <div className="mb-2 flex gap-2">{[action.unit, action.unit * 2, action.unit * 3].map(preset => <button key={preset} type="button" disabled={locked}
            aria-pressed={amount === preset} onClick={() => setValue(String(preset))}
            className={`flex-1 border px-3 py-2 text-sm disabled:opacity-40 ${amount === preset ? 'border-accent text-accent' : 'border-border text-muted hover:text-white'}`}>
            {preset.toLocaleString()}
          </button>)}</div>
          <input id={amountId} type="number" inputMode="numeric" min="1" max={MAX_BUY_IN_AMOUNT} step="1" value={value}
            disabled={locked} onChange={e => setValue(e.target.value)}
            className="w-full border border-border bg-bg px-3 py-2 text-sm focus:border-white disabled:opacity-50" /></>}
          {error && <p role="alert" className="mt-4 text-xs text-danger">{error}{retrying && ' Retry this same request before starting another buy-in.'}</p>}
          <button type="submit" disabled={pending || creating || (addingNew && !!newName.trim()) || (!retrying && !valid)} className="mt-5 w-full bg-white py-3 text-xs tracking-widest text-bg hover:bg-accent disabled:opacity-40">
            {pending ? 'SAVING...' : retrying ? 'RETRY' : addingPlayers ? 'ADD' : 'BUY IN'}
          </button>
        </form>
      )}
    </dialog>
  )
}
