'use client'

import { useState } from 'react'
import { createPlayerInGroup } from './client'
import type { Player } from './domain-types'
import type { SelectablePlayer } from './player-selection'

interface Options {
  groupId: string
  players: Player[]
  excludedIds: string[]
  excludedMessage: string
  retainCreatedSelections?: boolean
  onCreated?: (row: Awaited<ReturnType<typeof createPlayerInGroup>>) => void
}

// Keeps newly created players available before refreshed server props arrive,
// and applies the same name matching/exclusion rules in every player picker.
export function usePlayerDirectory(options: Options) {
  const [created, setCreated] = useState<Player[]>([])
  const [retainedIds, setRetainedIds] = useState<string[]>([])
  const serverIds = new Set(options.players.map(player => player.id))
  const localPlayers = created.filter(player => !serverIds.has(player.id)
    || (options.retainCreatedSelections && retainedIds.includes(player.id)))
  const localIds = new Set(localPlayers.map(player => player.id))
  const players = [...localPlayers, ...options.players.filter(player => !localIds.has(player.id))]
  const excluded = new Set(options.excludedIds)
  const available = players.filter(player => !excluded.has(player.id)
    || (options.retainCreatedSelections && retainedIds.includes(player.id)))

  async function create(name: string): Promise<SelectablePlayer> {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Enter a player name.')
    let player = players.find(item => item.name.trim().toLowerCase() === trimmed.toLowerCase())
    const existingId = player?.id
    if (existingId && !available.some(item => item.id === existingId)) throw new Error(options.excludedMessage)
    if (!player) {
      const row = await createPlayerInGroup(options.groupId, trimmed)
      player = row.player
      const added = player
      setCreated(current => [added, ...current.filter(item => item.id !== added.id)])
      if (options.retainCreatedSelections) setRetainedIds(current => [...current, added.id])
      options.onCreated?.(row)
    }
    return { player_id: player.id, name: player.name, settled_at: null }
  }

  return { players, participants: available.map(player => ({ player_id: player.id, name: player.name, settled_at: null })),
    create, resetSelection: () => setRetainedIds([]) }
}
