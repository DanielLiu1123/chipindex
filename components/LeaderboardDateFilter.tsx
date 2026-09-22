'use client'

import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { leaderboardRangeError, presetLeaderboardRange, type LeaderboardFilter, type LeaderboardPeriod, type LeaderboardRange } from '@/lib/leaderboard-range'

const PERIODS = [
  ['all', 'ALL TIME'],
  ['month', 'THIS MONTH'],
  ['last-month', 'LAST MONTH'],
  ['year', 'THIS YEAR'],
  ['custom', 'CUSTOM…'],
] as const satisfies ReadonlyArray<readonly [LeaderboardPeriod, string]>

function filterLabel(filter: LeaderboardFilter): string {
  if (filter.period !== 'custom') return PERIODS.find(([period]) => period === filter.period)![1]
  const { start, end } = filter.range
  const last = start.slice(0, 4) === end.slice(0, 4) ? end.slice(5) : end
  return `${start}–${last}`
}

interface Props {
  filter: LeaderboardFilter
  onChange: (filter: LeaderboardFilter) => void
}

export default function LeaderboardDateFilter({ filter, onChange }: Props) {
  const [panel, setPanel] = useState<'options' | 'custom' | null>(null)
  const [draft, setDraft] = useState<LeaderboardRange>({ start: '', end: '' })
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const errorId = useId()
  const error = panel === 'custom' ? leaderboardRangeError(draft) : null

  function close() {
    setPanel(null)
    trigger.current?.focus()
  }

  useEffect(() => {
    if (!panel) return
    content.current?.querySelector<HTMLElement>('input, button')?.focus()
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setPanel(null)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [panel])

  function selectPeriod(period: LeaderboardPeriod) {
    if (period === 'custom') {
      setDraft(filter.period === 'all' ? presetLeaderboardRange('month') : { ...filter.range })
      setPanel('custom')
      return
    }
    onChange(period === 'all' ? { period } : { period, range: presetLeaderboardRange(period) })
    close()
  }

  return (
    <div ref={root} className="relative mb-4"
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPanel(null) }}
      onKeyDown={event => {
        if (event.key === 'Escape' && panel) { event.preventDefault(); event.stopPropagation(); close() }
      }}>
      <button ref={trigger} type="button" aria-label={`Date range: ${filterLabel(filter)}`}
        aria-expanded={panel !== null} aria-controls={panel ? panelId : undefined} aria-haspopup="dialog"
        onClick={() => panel ? close() : setPanel('options')}
        className="inline-flex items-center gap-3 border border-border bg-surface px-3 py-1.5 text-xs tracking-widest text-[#aaaaaa] transition-colors hover:border-muted hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        {filterLabel(filter)}<span aria-hidden="true" className="text-muted">{panel ? '▴' : '▾'}</span>
      </button>
      {panel && (
        <div ref={content} id={panelId} role="dialog" aria-label="Date range"
          className={`absolute left-0 top-full z-20 mt-2 max-w-full border border-border bg-surface shadow-xl ${panel === 'custom' ? 'w-80 p-3' : 'w-48 py-1'}`}>
          {panel === 'options' ? PERIODS.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter.period === value} onClick={() => selectPeriod(value)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs tracking-widest transition-colors hover:bg-white/5 focus-visible:outline-1 focus-visible:outline-accent ${value === 'custom' ? 'border-t border-border' : ''} ${filter.period === value ? 'text-accent' : 'text-[#aaaaaa]'}`}>
              <span aria-hidden="true" className="w-3">{filter.period === value ? '✓' : ''}</span>{label}
            </button>
          )) : (
            <form onSubmit={event => {
              event.preventDefault()
              if (!error) { onChange({ period: 'custom', range: draft }); close() }
            }}>
              <p className="mb-3 text-xs text-muted tracking-widest">CUSTOM RANGE</p>
              <div className="flex items-center gap-2">
                {(['start', 'end'] as const).map((field, index) => (
                  <Fragment key={field}>
                    {index > 0 && <span aria-hidden="true" className="text-xs text-muted">–</span>}
                    <input type="date" aria-label={field === 'start' ? 'Start date' : 'End date'} value={draft[field]}
                      aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
                      onChange={event => setDraft(current => ({ ...current, [field]: event.target.value }))}
                      className="w-full min-w-0 border border-border bg-bg px-2 py-2 text-xs text-white outline-none transition-colors focus:border-white" />
                  </Fragment>
                ))}
              </div>
              {error && <p id={errorId} role="alert" className="mt-3 text-xs text-danger">{error}</p>}
              <div className="mt-4 flex items-center justify-between">
                <button type="button" onClick={() => setPanel('options')} className="text-xs tracking-widest text-muted hover:text-white">BACK</button>
                <button type="submit" disabled={Boolean(error)} className="border border-accent/60 bg-accent/10 px-3 py-1.5 text-xs tracking-widest text-accent disabled:opacity-40">APPLY</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
