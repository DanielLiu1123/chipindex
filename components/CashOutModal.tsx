'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import ChipValue from '@/components/ChipValue'
import type { LiveParticipant } from '@/lib/queries'
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
  }, [participant])

  useEffect(() => {
    if (!participant) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [participant, pending, onCancel])

  if (!participant) return null

  const finalChips = Number(value)
  const valid = /^\d+$/.test(value) && Number.isSafeInteger(finalChips)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (valid && !pending) onConfirm(finalChips)
  }

  return createPortal(
    <div className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 sm:items-center" onClick={() => !pending && onCancel()}>
      <form role="dialog" aria-modal="true" aria-labelledby="cash-out-modal-title"
        className="max-h-[calc(100dvh-2rem)] w-full max-w-xs overflow-y-auto border border-border bg-surface p-4"
        onSubmit={submit} onClick={event => event.stopPropagation()}>
        <p id="cash-out-modal-title" className="mb-4 text-sm font-medium text-white">CASH OUT — {participant.name.toUpperCase()}</p>

        <div className="mb-3 flex items-center justify-between text-xs">
          <span className="text-muted tracking-widest">TOTAL BUY-IN</span>
          <span className="text-white tabular-nums">{participant.total_buyin.toLocaleString()}</span>
        </div>

        <div className="flex items-center gap-3">
          <label className="shrink-0 text-xs tracking-widest text-muted" htmlFor="cash-out-final-chips">FINAL CHIPS</label>
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
          <span className="text-muted tracking-widest">NET RESULT</span>
          {valid ? <ChipValue chips={netChips(finalChips, participant.total_buyin)} /> : <span className="text-muted">—</span>}
        </div>

        {error && <p className="text-danger text-xs mt-3">{error}</p>}

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={pending}
            className="min-h-11 border border-border px-4 py-2 text-xs font-medium tracking-widest text-muted transition-colors hover:border-white hover:text-white disabled:opacity-40">
            CANCEL
          </button>
          <button type="submit" disabled={!valid || pending}
            className="min-h-11 bg-white px-4 py-2 text-xs font-medium tracking-widest text-bg transition-colors hover:bg-accent disabled:opacity-40">
            {pending ? 'CASHING OUT...' : 'CONFIRM'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
