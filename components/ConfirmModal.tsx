'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { Button } from '@/components/ui/button'

import { useRef, useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
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

function Confirmation({
  title,
  description,
  confirmLabel = 'DELETE',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const returnFocus = useRef<HTMLElement | null>(null)
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  async function confirm() {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError('')
    try {
      await onConfirm()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  return (
    <AlertDialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) onCancel()
      }}
    >
      <AlertDialogContent
        onOpenAutoFocus={() => {
          returnFocus.current = document.activeElement as HTMLElement
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus.current?.focus()
        }}
        aria-busy={pending}
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>CANCEL</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => {
              void confirm()
            }}
          >
            {pending ? 'SAVING...' : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
