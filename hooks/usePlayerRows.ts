'use client'

import { useState, useEffect } from 'react'
import type { Player } from '@/types'
import { api } from '@/lib/client'

// Shared state for the session forms' dynamic player rows: the player list,
// per-row patching keyed by a transient uid, and the used-id set that keeps
// PlayerSelect options unique across rows.

export interface PlayerRowBase {
  uid: string
  playerId: string
  isNew: boolean
  newName: string
}

export function usePlayerRows<R extends PlayerRowBase>(groupId: string, initialRows: R[]) {
  const [rows, setRows] = useState<R[]>(initialRows)
  const [players, setPlayers] = useState<Player[]>([])
  const [playersLoading, setPlayersLoading] = useState(true)
  const [playersError, setPlayersError] = useState('')

  useEffect(() => {
    api<Player[]>('GET', `/api/groups/${groupId}/players`)
      .then(ps => setPlayers(ps))
      .catch(() => setPlayersError('Failed to load players.'))
      .finally(() => setPlayersLoading(false))
  }, [groupId])

  const updateRow = (uid: string, patch: Partial<R>) =>
    setRows(r => r.map(row => (row.uid === uid ? { ...row, ...patch } : row)))

  const removeRow = (uid: string) => setRows(r => r.filter(row => row.uid !== uid))

  const usedIds = rows.map(r => r.playerId).filter(Boolean)

  return { rows, setRows, updateRow, removeRow, usedIds, players, playersLoading, playersError }
}

// Resolve a row to a player id, creating the player first when the row holds
// a new name instead of a selection.
export async function resolvePlayerId(groupId: string, row: PlayerRowBase): Promise<string> {
  if (row.isNew && row.newName.trim()) {
    const p = await api<Player>('POST', `/api/groups/${groupId}/players`, { name: row.newName.trim() })
    return p.id
  }
  return row.playerId
}
