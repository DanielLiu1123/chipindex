'use client'

import type { MouseEventHandler } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DeleteIconButton({ label, disabled, onClick }: {
  label: string
  disabled?: boolean
  onClick: MouseEventHandler<HTMLButtonElement>
}) {
  return (
    <Button variant="ghost" type="button" aria-label={label} disabled={disabled} onClick={onClick}
      className="size-8 shrink-0 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
      <Trash2 className="size-4" aria-hidden="true" />
    </Button>
  )
}
