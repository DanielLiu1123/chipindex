'use client'

import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'

type Props = Omit<ComponentProps<typeof Button>, 'children' | 'type'> & {
  action: 'add-player' | 'buy-in'
  compact?: boolean
}

export default function PlayerActionButton({ action, compact = false, ...props }: Props) {
  return <Button variant={action === 'add-player' ? 'outline' : 'default'} size={compact ? 'sm' : 'default'} {...props} type="button">
    {action === 'add-player' ? '+ PLAYER' : '+ BUY IN'}
  </Button>
}
