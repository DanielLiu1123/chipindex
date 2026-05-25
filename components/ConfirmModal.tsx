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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="bg-surface border border-border w-full max-w-sm mx-4 p-6 flex flex-col gap-6"
        onClick={e => e.stopPropagation()}
      >
        <div>
          <p className="text-white text-sm font-medium">{title}</p>
          {description && <p className="text-muted text-xs mt-1">{description}</p>}
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="text-xs font-medium tracking-widest text-muted hover:text-white border border-border hover:border-white px-4 py-2 transition-colors">
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            className="text-xs font-medium tracking-widest text-red-500 hover:text-red-400 border border-red-500/40 hover:border-red-400 px-4 py-2 transition-colors">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
