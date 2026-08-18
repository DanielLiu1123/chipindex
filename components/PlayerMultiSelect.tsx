'use client'

import { useEffect, useRef, useState } from 'react'
import type { Player } from '@/lib/domain-types'

export default function PlayerMultiSelect({ players, excludedIds, onAdd, onNew }: {
  players: Player[]
  excludedIds: string[]
  onAdd: (ids: string[]) => void
  onNew?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const close = () => {
    setOpen(false)
    setQuery('')
    setSelected(new Set())
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) close()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  })

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  const available = players.filter(player => !excludedIds.includes(player.id))
  const filtered = available.filter(player => player.name.toLowerCase().includes(query.toLowerCase()))

  function toggle(id: string) {
    setSelected(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function confirm() {
    const ids = available.filter(player => selected.has(player.id)).map(player => player.id)
    if (ids.length === 0) return
    onAdd(ids)
    close()
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => open ? close() : setOpen(true)}
        className="w-full border border-border text-muted hover:text-white hover:border-white text-xs tracking-widest px-4 py-2.5 text-left transition-colors">
        SELECT PLAYERS
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface border border-border shadow-lg">
          <div className="border-b border-border px-3 py-2">
            <input ref={inputRef} type="text" value={query} onChange={event => setQuery(event.target.value)}
              placeholder="search..." className="w-full bg-transparent text-sm text-white placeholder:text-muted outline-none" />
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <p className="px-4 py-2.5 text-sm text-muted">no results</p>
            ) : filtered.map(player => (
              <button key={player.id} type="button" onClick={() => toggle(player.id)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left text-white transition-colors hover:bg-white/10">
                <span>{player.name}</span>
                <span className={`w-3 h-3 border flex items-center justify-center ${selected.has(player.id) ? 'border-accent text-accent' : 'border-border'}`}>
                  {selected.has(player.id) && '✓'}
                </span>
              </button>
            ))}
          </div>
          {onNew && <button type="button" onClick={() => { onNew(); close() }}
            className="w-full border-t border-border px-4 py-2.5 text-sm text-left text-muted hover:bg-white/10">
            + NEW PLAYER
          </button>}
          <button type="button" onClick={confirm} disabled={selected.size === 0}
            className="w-full border-t border-border bg-white text-bg text-xs tracking-widest px-4 py-2.5 disabled:opacity-40">
            ADD {selected.size} {selected.size === 1 ? 'PLAYER' : 'PLAYERS'}
          </button>
        </div>
      )}
    </div>
  )
}
