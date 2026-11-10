'use client'

import { useState } from 'react'
import { CalendarIcon, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { localDate } from '@/lib/browser-time'

export default function DatePicker({
  value,
  onChange,
  disabled,
  id,
  label = 'Date',
  compact = false,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  compact?: boolean
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? new Date(`${value}T12:00:00`) : undefined
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={label}
          className={cn("w-full justify-start border-input bg-card font-normal hover:border-ring hover:bg-card dark:bg-card dark:hover:bg-card", compact && "justify-center gap-1.5 px-2")}
        >
          <CalendarIcon />
          <span className={cn("min-w-0 tabular-nums", !compact && "flex-1 text-left")}>{value || 'yyyy-MM-dd'}</span>
          {!compact && <ChevronDown className="text-muted-foreground" aria-hidden="true" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          autoFocus
          onSelect={(date) => {
            if (date) {
              onChange(localDate(date))
              setOpen(false)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
