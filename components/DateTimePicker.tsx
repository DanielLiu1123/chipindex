'use client'

import { useState } from 'react'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { localDate } from '@/lib/browser-time'

export default function DateTimePicker({ value, onChange, disabled, label }: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  label: string
}) {
  const [open, setOpen] = useState(false)
  const [date, time = ''] = value.split('T')
  const parsed = new Date(`${date}T12:00:00`)
  const selected = Number.isFinite(parsed.getTime()) && localDate(parsed) === date ? parsed : undefined

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <div className="relative min-w-0">
        <Input disabled={disabled} value={value.replace('T', ' ')} aria-label={label}
          placeholder="yyyy-MM-dd HH:mm:ss" className="pl-9"
          onChange={event => onChange(event.target.value.replace(' ', 'T'))} />
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" disabled={disabled}
            className="absolute left-1 top-1/2 -translate-y-1/2" aria-label={`Choose ${label}`}>
            <CalendarIcon className="size-4" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-0" aria-label={`Choose ${label}`}>
        <Calendar mode="single" selected={selected} defaultMonth={selected} autoFocus captionLayout="dropdown"
          onSelect={day => { if (day) onChange(`${localDate(day)}T${time || '00:00:00'}`) }} />
        <div className="flex items-end gap-3 border-t p-3">
          <label className="flex min-w-0 flex-1 flex-col gap-2 text-xs">
            TIME
            <Input type="time" step="1" value={time} aria-label={`Time for ${label}`}
              onChange={event => onChange(`${selected ? date : localDate()}T${event.target.value}`)} />
          </label>
          <Button type="button" className="h-8 text-xs" onClick={() => setOpen(false)}>DONE</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
