'use client'

import { Fragment, useId, useState } from 'react'
import { leaderboardRangeError, type LeaderboardRange } from '@/lib/leaderboard-range'

interface Props {
  initialRange: LeaderboardRange
  onBack: () => void
  onApply: (range: LeaderboardRange) => void
}

// The draft exists only while this editor is mounted. Dismissal and Back discard
// it automatically; only a valid submission can change the applied filter.
export default function LeaderboardCustomRangeForm({ initialRange, onBack, onApply }: Props) {
  const [draft, setDraft] = useState(initialRange)
  const error = leaderboardRangeError(draft)
  const errorId = useId()

  return (
    <form onSubmit={event => {
      event.preventDefault()
      if (!error) onApply(draft)
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
        <button type="button" onClick={onBack} className="text-xs tracking-widest text-muted hover:text-white">BACK</button>
        <button type="submit" disabled={Boolean(error)} className="border border-accent/60 bg-accent/10 px-3 py-1.5 text-xs tracking-widest text-accent disabled:opacity-40">APPLY</button>
      </div>
    </form>
  )
}
