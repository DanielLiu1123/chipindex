'use client'

import { useEffect, useEffectEvent } from 'react'
import { toast } from 'sonner'
import type { BatchBuyInCommand } from '@/lib/contracts'
import type { LiveParticipant } from '@/lib/domain-types'
import { completedBuyInTotals } from '@/lib/buy-in-notice'

export default function BuyInNotice({
  command,
  participants,
  onDismiss,
}: {
  command: BatchBuyInCommand | null
  participants: LiveParticipant[]
  onDismiss: () => void
}) {
  const dismiss = useEffectEvent(onDismiss)
  const totals = command ? completedBuyInTotals(participants, command) : null
  // Totals can arrive on the router refresh after the command succeeds.
  const description = totals
    ?.map(
      (player) =>
        `${player.name}: ${player.total_buyin.toLocaleString()} chips`,
    )
    .join('\n')
  const count = totals?.length ?? 0
  useEffect(() => {
    if (!command || !description) return
    const id = command.entries.map((entry) => entry.id).join(':')
    toast.success('Buy-in summary', {
      id,
      description,
      duration: 3000 + (count - 1) * 2000,
      onDismiss: () => dismiss(),
      onAutoClose: () => dismiss(),
      classNames: { description: 'whitespace-pre-line' },
    })
    return () => { toast.dismiss(id) }
  }, [command, description, count])
  return null
}
