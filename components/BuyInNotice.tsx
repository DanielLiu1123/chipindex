'use client'

import { useEffect } from 'react'
import type { BatchBuyInCommand } from '@/lib/contracts'
import type { LiveParticipant } from '@/lib/queries'
import { completedBuyInTotals } from '@/lib/buy-in-notice'

interface Props {
  command: BatchBuyInCommand | null
  participants: LiveParticipant[]
  onDismiss: () => void
}

const DISPLAY_MS_PER_PLAYER = 2000

export default function BuyInNotice({ command, participants, onDismiss }: Props) {
  const totals = command ? completedBuyInTotals(participants, command) : null
  const playerCount = totals?.length ?? 0

  useEffect(() => {
    if (playerCount === 0) return
    const timer = setTimeout(onDismiss, playerCount * DISPLAY_MS_PER_PLAYER)
    return () => clearTimeout(timer)
  }, [command, playerCount, onDismiss])

  return (
    <div role="status" aria-atomic="true" className="pointer-events-none fixed right-4 top-4 z-50 w-[calc(100%-2rem)] max-w-sm">
      {totals && <div className="border border-accent/30 bg-surface p-4 shadow-lg">
        <p className="mb-3 text-xs tracking-widest text-muted">TOTAL BUY-IN · CHIPS</p>
        {totals.map(player => <div key={player.player_id} className="flex items-baseline justify-between gap-4 py-1 text-sm">
          <span className="min-w-0 break-words text-white">{player.name}</span>
          <span className="shrink-0 tabular-nums text-accent">{player.total_buyin.toLocaleString()}</span>
        </div>)}
      </div>}
    </div>
  )
}
