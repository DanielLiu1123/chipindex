'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { presetLeaderboardRange, type LeaderboardFilter, type LeaderboardPeriod } from '@/lib/leaderboard-range'
import LeaderboardCustomRangeForm from '@/components/LeaderboardCustomRangeForm'

const PERIODS: readonly LeaderboardPeriod[] = ['all', 'month', 'last-month', 'year', 'custom']
const PERIOD_LABELS: Record<LeaderboardPeriod, string> = {
  all: 'ALL TIME',
  month: 'THIS MONTH',
  'last-month': 'LAST MONTH',
  year: 'THIS YEAR',
  custom: 'CUSTOM…',
}

function filterLabel(filter: LeaderboardFilter): string {
  if (filter.period !== 'custom') return PERIOD_LABELS[filter.period]
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
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const label = filterLabel(filter)

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
      <button ref={trigger} type="button" aria-label={`Date range: ${label}`}
        aria-expanded={panel !== null} aria-controls={panel ? panelId : undefined} aria-haspopup="dialog"
        onClick={() => panel ? close() : setPanel('options')}
        className="inline-flex items-center gap-3 border border-border bg-surface px-3 py-1.5 text-xs tracking-widest text-[#aaaaaa] transition-colors hover:border-muted hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        {label}<span aria-hidden="true" className="text-muted">{panel ? '▴' : '▾'}</span>
      </button>
      {panel && (
        <div ref={content} id={panelId} role="dialog" aria-label="Date range"
          className={`absolute left-0 top-full z-20 mt-2 max-w-full border border-border bg-surface shadow-xl ${panel === 'custom' ? 'w-80 p-3' : 'w-48 py-1'}`}>
          {panel === 'options' ? PERIODS.map(value => (
            <button key={value} type="button" aria-pressed={filter.period === value} onClick={() => selectPeriod(value)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs tracking-widest transition-colors hover:bg-white/5 focus-visible:outline-1 focus-visible:outline-accent ${value === 'custom' ? 'border-t border-border' : ''} ${filter.period === value ? 'text-accent' : 'text-[#aaaaaa]'}`}>
              <span aria-hidden="true" className="w-3">{filter.period === value ? '✓' : ''}</span>{PERIOD_LABELS[value]}
            </button>
          )) : (
            <LeaderboardCustomRangeForm
              initialRange={filter.period === 'all' ? presetLeaderboardRange('month') : filter.range}
              onBack={() => setPanel('options')}
              onApply={range => { onChange({ period: 'custom', range }); close() }}
            />
          )}
        </div>
      )}
    </div>
  )
}
