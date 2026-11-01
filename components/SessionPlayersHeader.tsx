'use client'

import PlayerActionButton from '@/components/PlayerActionButton'

export default function SessionPlayersHeader({ disabled, onAdd }: {
  disabled?: boolean
  onAdd: () => void
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-xs font-normal text-muted-foreground tracking-normal">PLAYERS</h2>
      <PlayerActionButton action="add-player" variant="default" disabled={disabled} onClick={onAdd} />
    </div>
  )
}
