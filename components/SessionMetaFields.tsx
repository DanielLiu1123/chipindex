'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

import DatePicker from '@/components/DatePicker'
import { DEFAULT_EXCHANGE_RATE } from '@/lib/session-rules'

// Date / exchange rate / description fields shared by all session forms.
export default function SessionMetaFields({
  disabled = false,
  compact = false,
  date, setDate,
  exchangeRate, setExchangeRate,
  description, setDescription,
}: {
  compact?: boolean
  disabled?: boolean
  date: string
  setDate: (v: string) => void
  exchangeRate: string
  setExchangeRate: (v: string) => void
  description: string
  setDescription: (v: string) => void
}) {
  return (
    <>
      <div className="flex gap-4">
        <div className={compact ? "w-[136px] shrink-0" : "flex-1"}>
          <Label className="text-xs text-muted-foreground tracking-normal block mb-2">DATE</Label>
          <DatePicker compact={compact} disabled={disabled} value={date} onChange={setDate} />
        </div>
        <div className={compact ? "w-20" : "w-32"}>
          <Label className="text-xs text-muted-foreground tracking-normal block mb-2">RATE</Label>
          <Input disabled={disabled} type="number" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} placeholder={String(DEFAULT_EXCHANGE_RATE)} min="1"
            className="w-full" />
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground tracking-normal block mb-2">DESCRIPTION</Label>
        <Input disabled={disabled} type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Friday game"
          className="w-full" />
      </div>
    </>
  )
}
