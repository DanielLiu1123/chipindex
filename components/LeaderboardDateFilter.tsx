'use client'

import { useState } from 'react'
import { CalendarIcon, Check, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  presetLeaderboardRange,
  type LeaderboardFilter,
  type LeaderboardPeriod,
} from '@/lib/leaderboard-range'
import LeaderboardCustomRangeForm from '@/components/LeaderboardCustomRangeForm'

const PERIODS: readonly LeaderboardPeriod[] = [
  'all',
  'month',
  'last-month',
  'year',
  'custom',
]
const LABELS: Record<LeaderboardPeriod, string> = {
  all: 'ALL TIME',
  month: 'THIS MONTH',
  'last-month': 'LAST MONTH',
  year: 'THIS YEAR',
  custom: 'CUSTOM…',
}

function filterLabel(filter: LeaderboardFilter) {
  if (filter.period !== 'custom') return LABELS[filter.period]
  const { start, end } = filter.range
  return `${start}–${start.slice(0, 4) === end.slice(0, 4) ? end.slice(5) : end}`
}

export default function LeaderboardDateFilter({
  filter,
  onChange,
}: {
  filter: LeaderboardFilter
  onChange: (filter: LeaderboardFilter) => void
}) {
  const [panel, setPanel] = useState<'options' | 'custom' | null>(null)
  const label = filterLabel(filter)
  function select(period: LeaderboardPeriod) {
    if (period === 'custom') {
      setPanel('custom')
      return
    }
    onChange(
      period === 'all'
        ? { period }
        : { period, range: presetLeaderboardRange(period) },
    )
    setPanel(null)
  }
  return (
    <div className="mb-4">
      <Popover
        open={panel !== null}
        onOpenChange={(open) => setPanel(open ? 'options' : null)}
      >
        <PopoverTrigger asChild>
          <Button variant="outline" aria-label={`Date range: ${label}`}>
            <CalendarIcon />
            {label}
            <ChevronDown />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto max-w-[calc(100vw-2rem)] p-0"
          aria-label="Date range"
        >
          {panel === 'custom' ? (
            <LeaderboardCustomRangeForm
              initialRange={
                filter.period === 'all'
                  ? presetLeaderboardRange('month')
                  : filter.range
              }
              onBack={() => setPanel('options')}
              onApply={(range) => {
                onChange({ period: 'custom', range })
                setPanel(null)
              }}
            />
          ) : (
            <div className="w-48 p-1">
              {PERIODS.map((period) => (
                <Button
                  key={period}
                  type="button"
                  variant="ghost"
                  className="w-full justify-start"
                  aria-pressed={filter.period === period}
                  onClick={() => select(period)}
                >
                  <Check
                    className={filter.period === period ? '' : 'invisible'}
                  />
                  {LABELS[period]}
                </Button>
              ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
