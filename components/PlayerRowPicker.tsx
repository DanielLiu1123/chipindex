'use client'

import type { Player } from '@/types'
import type { PlayerRowBase } from '@/hooks/usePlayerRows'
import PlayerSelect from '@/components/PlayerSelect'

// Player slot within a form row: an existing-player select that flips into a
// new-name input when "__new__" is chosen. Players already used by other rows
// are filtered out of the options.
export default function PlayerRowPicker({
  row, players, usedIds, onPatch,
}: {
  row: PlayerRowBase
  players: Player[]
  usedIds: string[]
  onPatch: (patch: Partial<PlayerRowBase>) => void
}) {
  if (row.isNew) {
    return (
      <input type="text" value={row.newName} onChange={e => onPatch({ newName: e.target.value })}
        placeholder="new player name"
        className="flex-1 bg-surface border border-accent text-white text-sm px-4 py-2.5 outline-none focus:border-white transition-colors placeholder:text-muted" />
    )
  }
  return (
    <PlayerSelect
      value={row.playerId}
      players={players.filter(p => !usedIds.includes(p.id) || p.id === row.playerId)}
      onChange={val => val === '__new__'
        ? onPatch({ isNew: true, playerId: '', newName: '' })
        : onPatch({ playerId: val })}
      className="flex-1"
    />
  )
}
