'use client'

import { useState, useRef, useEffect } from 'react'
import type { Player } from '@/lib/domain-types'

interface PlayerSelectProps {
  value: string
  players: Player[]
  onChange: (value: string) => void
  className?: string
}

export default function PlayerSelect({ value, players, onChange, className = '' }: PlayerSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const filtered = players.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
  const selectedPlayer = players.find(p => p.id === value)
  const label = selectedPlayer ? selectedPlayer.name : 'select player'

  function select(val: string) {
    onChange(val)
    setOpen(false)
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-surface border border-border text-sm px-4 py-2.5 outline-none focus:border-white transition-colors text-left"
      >
        <span className={selectedPlayer ? 'text-white' : 'text-muted'}>{label}</span>
        <svg
          className={`w-3 h-3 text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
        >
          <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 max-h-[min(70dvh,24rem)] border border-border bg-surface shadow-lg sm:absolute sm:inset-x-0 sm:bottom-auto sm:top-full sm:mt-1 sm:max-h-none">
          <div className="border-b border-border px-3 py-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="search..."
              className="w-full bg-transparent text-sm text-white placeholder:text-muted outline-none"
            />
          </div>
          <div className="max-h-[calc(70dvh-7rem)] overflow-y-auto sm:max-h-48">
            {filtered.length === 0 ? (
              <p className="px-4 py-2.5 text-sm text-muted">no results</p>
            ) : (
              filtered.map(p => (
                <Option
                  key={p.id}
                  label={p.name}
                  selected={p.id === value}
                  onClick={() => select(p.id)}
                />
              ))
            )}
          </div>
          <div className="border-t border-border">
            <Option
              label="+ new player"
              selected={false}
              muted
              onClick={() => select('__new__')}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function Option({ label, selected, muted, onClick }: {
  label: string
  selected: boolean
  muted?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors hover:bg-white/10 ${muted ? 'text-muted' : 'text-white'}`}
    >
      <span>{label}</span>
      {selected && !muted && (
        <svg className="w-3 h-3 text-accent shrink-0" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}
