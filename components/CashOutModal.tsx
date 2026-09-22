'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

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
        <p className="mb-4 text-sm font-medium text-foreground">{participant.name}</p>

        <div className="mb-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground tracking-normal">BUY-IN</span>
          <span className="text-foreground tabular-nums">{participant.total_buyin.toLocaleString()}</span>
        </div>

        <div className="flex items-center gap-3">
          <Label className="shrink-0 text-xs tracking-normal text-muted-foreground" htmlFor="cash-out-final-chips">CHIPS</Label>
          <Input
            id="cash-out-final-chips"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            autoFocus
            value={value}
            onChange={event => setValue(event.target.value)}
            disabled={pending}
            className="min-w-0 flex-1 text-right"
          />
        </div>
        {value && !valid && <Alert variant="destructive"><AlertDescription>Enter a non-negative whole number.</AlertDescription></Alert>}

        <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="text-muted-foreground tracking-normal">NET</span>
          {valid ? <ChipValue chips={netChips(finalChips, participant.total_buyin)} /> : <span className="text-muted-foreground">—</span>}
        </div>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onCancel} disabled={pending}
            >
            CANCEL
          </Button>
          <Button variant="default" type="submit" disabled={!valid || pending}
            >
            {pending ? 'SAVING...' : 'CASH OUT'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
