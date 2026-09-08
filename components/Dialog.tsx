'use client'

import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  label: string
  pending?: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}

// Native modal dialogs provide inert background, focus containment and Escape
// semantics. This module owns controlled open/close and restores trigger focus.
// The top layer preserves DOM ancestry and CSS inheritance. Set a typography
// baseline here so table cells and other callers cannot restyle modal content.
export default function Dialog({ open, label, pending = false, onClose, children, className = 'max-w-md p-5' }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(false)
  // Capture before child autofocus runs during commit. Re-capture each opening.
  if (open && !wasOpen.current && typeof document !== 'undefined') {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
  }
  wasOpen.current = open
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
      trigger.current?.focus()
    }
    return () => {
      if (dialog.open) dialog.close()
      if (trigger.current?.isConnected) trigger.current.focus()
    }
  }, [open])

  function dismiss() {
    if (!pending) onClose()
  }
  return <dialog ref={ref} aria-label={label} aria-modal="true" aria-busy={pending}
    onCancel={event => { event.preventDefault(); dismiss() }}
    onClick={event => {
      if (event.target !== event.currentTarget) return
      const rect = event.currentTarget.getBoundingClientRect()
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismiss()
    }}
    className={`fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto border border-border bg-surface font-mono text-base font-normal not-italic tracking-normal normal-case whitespace-normal text-left text-white backdrop:bg-black/70 ${className}`}>
    {children}
  </dialog>
}
