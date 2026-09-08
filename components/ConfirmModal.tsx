'use client'

import { useRef, useState } from 'react'
import Dialog from './Dialog'
import { errorMessage } from '@/lib/error-message'

interface ConfirmModalProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export default function ConfirmModal(props: ConfirmModalProps) {
  if (!props.open) return null
  return <Confirmation {...props} />
}

function Confirmation({ title, description, confirmLabel = 'DELETE', onConfirm, onCancel }: ConfirmModalProps) {
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function confirm() {
    if (busy.current) return
    busy.current = true; setPending(true); setError('')
    try {
      await onConfirm()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      busy.current = false; setPending(false)
    }
  }
  return <Dialog open label={title} pending={pending} onClose={onCancel} className="max-w-sm p-6">
    <div className="flex flex-col gap-6">
      <div><p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}</div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" autoFocus disabled={pending} onClick={onCancel} className="border border-border px-4 py-2 text-xs font-medium tracking-widest text-muted hover:border-white hover:text-white transition-colors disabled:opacity-40">CANCEL</button>
        <button type="button" disabled={pending} onClick={() => { void confirm() }} className="border border-red-500/40 px-4 py-2 text-xs font-medium tracking-widest text-red-500 hover:border-red-400 transition-colors disabled:opacity-40">{pending ? 'SAVING...' : confirmLabel}</button>
      </div>
    </div>
  </Dialog>
}
