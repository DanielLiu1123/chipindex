'use client'

import { useState, type FormEvent } from 'react'
import Dialog from './Dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function SessionRateModal({ rate, pending, error, onConfirm, onCancel }: {
  rate: number
  pending: boolean
  error: string
  onConfirm: (rate: number) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(String(rate))
  const parsed = Number(value)
  const valid = value.trim() !== '' && Number.isFinite(parsed) && parsed > 0

  function submit(event: FormEvent) {
    event.preventDefault()
    if (valid && !pending) onConfirm(parsed)
  }

  return (
    <Dialog open label="Edit rate" pending={pending} onClose={onCancel} className="max-w-xs p-4">
      <form onSubmit={submit} className="w-full">
        <Label htmlFor="session-rate">RATE (CHIPS PER 1 CNY)</Label>
        <Input id="session-rate" type="number" inputMode="decimal" step="any" required autoFocus
          value={value} onChange={event => setValue(event.target.value)} disabled={pending} className="mt-2" />
        {!valid && <p className="mt-2 text-xs text-destructive">Enter a number greater than 0.</p>}
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={onCancel} disabled={pending}>CANCEL</Button>
          <Button type="submit" disabled={!valid || pending}>{pending ? 'SAVING...' : 'SAVE'}</Button>
        </div>
      </form>
    </Dialog>
  )
}
