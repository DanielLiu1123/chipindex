'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmModalProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'DELETE',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/60 sm:items-center"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col gap-6 overflow-y-auto border border-border bg-surface p-5 sm:p-6"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <p id="confirm-modal-title" className="text-sm font-medium text-white">{title}</p>
          {description && <p className="text-muted text-xs mt-1">{description}</p>}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={onCancel}
            className="min-h-11 border border-border px-4 py-2 text-xs font-medium tracking-widest text-muted transition-colors hover:border-white hover:text-white">
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="min-h-11 border border-red-500/40 px-4 py-2 text-xs font-medium tracking-widest text-red-500 transition-colors hover:border-red-400 hover:text-red-400">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
