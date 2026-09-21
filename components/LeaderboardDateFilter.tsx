'use client'

import { Fragment, useId } from 'react'
import { presetLeaderboardRange, type LeaderboardFilter, type LeaderboardPeriod } from '@/lib/leaderboard-range'

const PERIODS = [
  ['all', 'ALL'],
  ['month', 'THIS MONTH'],
  ['last-month', 'LAST MONTH'],
  ['year', 'THIS YEAR'],
  ['custom', 'CUSTOM'],
] as const satisfies ReadonlyArray<readonly [LeaderboardPeriod, string]>

interface Props {
  filter: LeaderboardFilter
  onChange: (filter: LeaderboardFilter) => void
  error: string | null
}

export default function LeaderboardDateFilter({ filter, onChange, error }: Props) {
  const errorId = useId()

  function selectPeriod(period: LeaderboardPeriod) {
    if (period === 'all') {
      onChange({ period })
    } else if (period === 'custom') {
      onChange({ period, range: filter.period === 'all' ? presetLeaderboardRange('month') : filter.range })
    } else {
      onChange({ period, range: presetLeaderboardRange(period) })
    }
  }

  return (
    <div className="mb-6">
      <div role="group" aria-label="Leaderboard period" className="flex flex-wrap items-center gap-2">
        {PERIODS.map(([value, label]) => (
          <button key={value} type="button" aria-pressed={filter.period === value} onClick={() => selectPeriod(value)}
            className={`min-h-9 border px-3 py-2 text-[10px] tracking-widest transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-xs ${filter.period === value ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border bg-surface text-[#aaaaaa] hover:border-muted hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>
      {filter.period === 'custom' && (
        <div className="mt-4 flex items-center gap-3 max-w-sm">
          {(['start', 'end'] as const).map((field, index) => (
            <Fragment key={field}>
              {index > 0 && <span aria-hidden="true" className="text-xs text-muted">–</span>}
              <input type="date" aria-label={field === 'start' ? 'Start date' : 'End date'} value={filter.range[field]}
                min={field === 'end' ? filter.range.start || undefined : undefined}
                max={field === 'start' ? filter.range.end || undefined : undefined}
                aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
                onChange={event => onChange({ period: 'custom', range: { ...filter.range, [field]: event.target.value } })}
                className="w-full min-w-0 bg-surface border border-border text-white text-xs px-3 py-2 outline-none focus:border-white transition-colors" />
            </Fragment>
          ))}
        </div>
      )}
      {error && <p id={errorId} role="alert" className="text-danger text-xs mt-4">{error}</p>}
    </div>
  )
}
