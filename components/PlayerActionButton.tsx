'use client'

import type { ComponentPropsWithoutRef } from 'react'

type Props = Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'type'> & {
  action: 'add-player' | 'buy-in'
  compact?: boolean
}

const colors = {
  'add-player': 'border-sky-300/25 bg-sky-300/[0.06] text-sky-300 hover:enabled:border-sky-300/45 hover:enabled:bg-sky-300/10',
  'buy-in': 'border-emerald-300/25 bg-emerald-300/[0.06] text-emerald-300 hover:enabled:border-emerald-300/45 hover:enabled:bg-emerald-300/10',
}

// Keep the same player/buy-in action styling across live, new, edit and settings.
export default function PlayerActionButton({ action, compact = false, className = '', ...props }: Props) {
  return <button {...props} type="button"
    className={`border text-center text-xs font-medium tracking-widest transition-colors disabled:opacity-40 ${colors[action]} ${compact ? 'shrink-0 px-4 py-2.5' : 'px-3 py-3'} ${className}`}>
    {action === 'add-player' ? '+ PLAYER' : '+ BUY IN'}
  </button>
}
