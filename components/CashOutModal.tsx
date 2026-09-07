'use client'

import { FormEvent, useEffect, useState } from 'react'
import Dialog from './Dialog'
import ChipValue from '@/components/ChipValue'
import type { LiveParticipant } from '@/lib/domain-types'
import { netChips } from '@/lib/settlement'

interface CashOutModalProps {
  participant: LiveParticipant | null
  pending: boolean
  error: string
  onConfirm: (finalChips: number) => void
  onCancel: () => void
}

export default function CashOutModal({ participant, pending, error, onConfirm, onCancel }: CashOutModalProps) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (participant) setValue('')
  }, [participant?.player_id])

  if (!participant) return null

  const finalChips = Number(value)
  const valid = /^\d+$/.test(value) && Number.isSafeInteger(finalChips)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (valid && !pending) onConfirm(finalChips)
  }

  return (
    <Dialog open label={`Cash out ${participant.name}`} pending={pending} onClose={onCancel} className="max-w-xs p-4">
      <form className="w-full" onSubmit={submit} onClick={event => event.stopPropagation()}>
        <p className="mb-4 text-sm font-medium text-white">{participant.name}</p>

        <div className="mb-3 flex items-center justify-between text-xs">
          <span className="text-muted tracking-widest">BUY-IN</span>
          <span className="text-white tabular-nums">{participant.total_buyin.toLocaleString()}</span>
        </div>

        <div className="flex items-center gap-3">
          <label className="shrink-0 text-xs tracking-widest text-muted" htmlFor="cash-out-final-chips">CHIPS</label>
          <input
            id="cash-out-final-chips"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            autoFocus
            value={value}
            onChange={event => setValue(event.target.value)}
            disabled={pending}
            className="min-w-0 flex-1 border border-border bg-bg px-3 py-2 text-right text-white outline-none transition-colors focus:border-white disabled:opacity-50"
          />
        </div>
        {value && !valid && <p className="text-danger text-xs mt-2">Enter a non-negative whole number.</p>}

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="text-muted tracking-widest">NET</span>
          {valid ? <ChipValue chips={netChips(finalChips, participant.total_buyin)} /> : <span className="text-muted">—</span>}
        </div>

        {error && <p role="alert" className="text-danger text-xs mt-3">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={pending}
            className="text-xs font-medium tracking-widest text-muted hover:text-white border border-border hover:border-white px-4 py-2 transition-colors disabled:opacity-40">
            CANCEL
          </button>
          <button type="submit" disabled={!valid || pending}
            className="text-xs font-medium tracking-widest text-bg bg-white hover:bg-accent px-4 py-2 transition-colors disabled:opacity-40">
            {pending ? 'SAVING...' : 'CASH OUT'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
