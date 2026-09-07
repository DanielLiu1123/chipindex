'use client'

import { DEFAULT_EXCHANGE_RATE } from '@/lib/session-rules'

// Date / exchange rate / description fields shared by all session forms.
export default function SessionMetaFields({
  disabled = false,
  date, setDate,
  exchangeRate, setExchangeRate,
  description, setDescription,
}: {
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
        <div className="flex-1">
          <label className="text-xs text-muted tracking-widest block mb-2">DATE</label>
          <input disabled={disabled} type="date" value={date} onChange={e => setDate(e.target.value)} required
            className="w-full bg-surface border border-border text-white text-sm px-4 py-3 outline-none focus:border-white transition-colors" />
        </div>
        <div className="w-32">
          <label className="text-xs text-muted tracking-widest block mb-2">RATE <span className="text-muted">(opt)</span></label>
          <input disabled={disabled} type="number" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} placeholder={String(DEFAULT_EXCHANGE_RATE)} min="1"
            className="w-full bg-surface border border-border text-white text-sm px-4 py-3 outline-none focus:border-white transition-colors placeholder:text-muted" />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted tracking-widest block mb-2">DESCRIPTION <span className="text-muted">(opt)</span></label>
        <input disabled={disabled} type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Friday game"
          className="w-full bg-surface border border-border text-white text-sm px-4 py-3 outline-none focus:border-white transition-colors placeholder:text-muted" />
      </div>
    </>
  )
}
