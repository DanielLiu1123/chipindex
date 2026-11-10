'use client'

import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { localDate } from '@/lib/browser-time'
import type { LeaderboardRange } from '@/lib/leaderboard-range'

export default function LeaderboardCustomRangeForm({
  initialRange,
  onApply,
}: {
  initialRange: LeaderboardRange
  onApply: (range: LeaderboardRange) => void
}) {
  const [draft, setDraft] = useState<DateRange | undefined>({
    from: new Date(`${initialRange.start}T12:00:00`),
    to: new Date(`${initialRange.end}T12:00:00`),
  })
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (draft?.from && draft.to)
          onApply({ start: localDate(draft.from), end: localDate(draft.to) })
      }}
    >
      <Calendar
        mode="range"
        resetOnSelect
        selected={draft}
        onSelect={setDraft}
        defaultMonth={draft?.from}
        autoFocus
        captionLayout="dropdown"
        aria-label="Date range calendar"
      />
      <div className="space-y-3 border-t p-3">
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {draft?.from ? localDate(draft.from) : 'Start date'} –{' '}
          {draft?.to ? localDate(draft.to) : 'End date'}
        </p>
        <div className="flex justify-end">
          <Button type="submit" className="h-8 px-3 text-xs" disabled={!draft?.from || !draft.to}>
            APPLY
          </Button>
        </div>
      </div>
    </form>
  )
}
