'use client'

import { useRef, type ReactNode } from 'react'
import {
  Dialog as Root,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  open: boolean
  label: string
  pending?: boolean
  onClose: () => void
  children: ReactNode
  className?: string
}

// Business dialogs share pending-operation protection; Radix owns focus,
// portals, dismissal and keyboard behavior.
export default function Dialog({
  open,
  label,
  pending = false,
  onClose,
  children,
  className,
}: Props) {
  const returnFocus = useRef<HTMLElement | null>(null)
  return (
    <Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onClose()
      }}
    >
      <DialogContent
        onOpenAutoFocus={() => {
          returnFocus.current = document.activeElement as HTMLElement
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus.current?.focus()
        }}
        className={`max-h-[90dvh] overflow-y-auto ${className ?? 'sm:max-w-md'}`}
        showCloseButton={!pending}
        aria-describedby={undefined}
        aria-busy={pending}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault()
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Root>
  )
}
