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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => !pending && onCancel()}>
      <form className="bg-surface border border-border w-full max-w-sm mx-4 p-6" onSubmit={submit} onClick={event => event.stopPropagation()}>
        <p className="text-white text-sm font-medium mb-5">CASH OUT — {participant.name.toUpperCase()}</p>

        <div className="flex items-center justify-between text-xs mb-4">
          <span className="text-muted tracking-widest">TOTAL BUY-IN</span>
          <span className="text-white tabular-nums">{participant.total_buyin.toLocaleString()}</span>
        </div>

        <label className="block text-xs text-muted tracking-widest mb-2" htmlFor="cash-out-final-chips">FINAL CHIPS</label>
        <input
          id="cash-out-final-chips"
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          autoFocus
          value={value}
          onChange={event => setValue(event.target.value)}
          placeholder="final chips"
          disabled={pending}
          className="w-full bg-bg border border-border text-white text-right px-3 py-2.5 outline-none focus:border-white transition-colors placeholder:text-muted disabled:opacity-50"
        />
        {value && !valid && <p className="text-danger text-xs mt-2">Enter a non-negative whole number.</p>}

        <div className="flex items-center justify-between text-xs border-t border-border mt-4 pt-4">
          <span className="text-muted tracking-widest">NET RESULT</span>
          {valid ? <ChipValue chips={netChips(finalChips, participant.total_buyin)} /> : <span className="text-muted">—</span>}
        </div>

        {error && <p className="text-danger text-xs mt-3">{error}</p>}

        <div className="flex gap-2 justify-end mt-5">
          <button type="button" onClick={onCancel} disabled={pending}
            className="text-xs font-medium tracking-widest text-muted hover:text-white border border-border hover:border-white px-4 py-2 transition-colors disabled:opacity-40">
            CANCEL
          </button>
          <button type="submit" disabled={!valid || pending}
            className="text-xs font-medium tracking-widest text-bg bg-white hover:bg-accent px-4 py-2 transition-colors disabled:opacity-40">
            {pending ? 'CASHING OUT...' : 'CONFIRM'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
