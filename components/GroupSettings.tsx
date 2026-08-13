'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import PlayerMultiSelect from '@/components/PlayerMultiSelect'
import { api } from '@/lib/client'
import type { Group, GroupPlayer, Player } from '@/types'

function byCreatedAt(
  a: { player: Player },
  b: { player: Player },
): number {
  return a.player.created_at.localeCompare(b.player.created_at)
    || a.player.id.localeCompare(b.player.id)
}

export default function GroupSettings({ group, initialGroupPlayers, players }: {
  group: Group
  initialGroupPlayers: Array<{ player: Player; group_player: GroupPlayer }>
  players: Player[]
}) {
  const router = useRouter()
  const [name, setName] = useState(group.name)
  const [savedName, setSavedName] = useState(group.name)
  const [groupPlayers, setGroupPlayers] = useState(initialGroupPlayers)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const playerIds = useMemo(() => new Set(groupPlayers.map(row => row.player.id)), [groupPlayers])

  async function run(action: () => Promise<void>) {
    setPending(true)
    setError('')
    try {
      await action()
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Request failed')
    } finally {
      setPending(false)
    }
  }

  function rename() {
    return run(async () => {
      const updated = await api<Group>('PATCH', `/api/groups/${group.id}`, { name })
      setName(updated.name)
      setSavedName(updated.name)
      window.dispatchEvent(new Event('chipindex:groups-changed'))
    })
  }

  function addPlayers(ids: string[]) {
    return run(async () => {
      const added = await Promise.all(ids.map(async playerId => {
        const player = players.find(item => item.id === playerId)
        if (!player) throw new Error('Player not found')
        const group_player = await api<GroupPlayer>('POST', `/api/groups/${group.id}/group-players`, { player_id: playerId })
        return { player, group_player }
      }))
      setGroupPlayers(current => [...current, ...added].sort(byCreatedAt))
    })
  }

  function setDeleted(row: { player: Player; group_player: GroupPlayer }, deleted: boolean) {
    return run(async () => {
      const group_player = await api<GroupPlayer>(deleted ? 'DELETE' : 'POST', `/api/groups/${group.id}/group-players`, { player_id: row.player.id })
      setGroupPlayers(current => current.map(item => item.player.id === row.player.id
        ? { ...item, group_player }
        : item))
    })
  }

  return <>
    <h1 className="text-xs text-muted tracking-widest mb-6">MANAGE GROUP</h1>
    <section className="max-w-lg mb-10">
      <label className="text-xs text-muted tracking-widest block mb-2">NAME</label>
      <div className="flex gap-2">
        <input value={name} onChange={event => setName(event.target.value)} className="flex-1 bg-surface border border-border text-white px-3 py-2 outline-none focus:border-white" />
        <button onClick={rename} disabled={pending || !name.trim() || name.trim() === savedName}
          className="border border-border text-xs tracking-widest px-4 disabled:opacity-40 hover:border-white">SAVE</button>
      </div>
    </section>

    <section className="max-w-lg">
      <h2 className="text-xs text-muted tracking-widest mb-3">PLAYERS</h2>
      <div className="flex flex-col gap-1.5 mb-6">
        {groupPlayers.map(row => <div key={row.group_player.id} className="flex items-center gap-3 border border-border px-3 py-2.5">
          <span className={`flex-1 ${row.group_player.deleted_at === null ? 'text-white' : 'text-muted'}`}>{row.player.name}</span>
          {row.group_player.deleted_at !== null && <span className="text-[10px] tracking-widest text-muted">INACTIVE</span>}
          <button onClick={() => setDeleted(row, row.group_player.deleted_at === null)} disabled={pending}
            className={`text-[10px] tracking-widest ${row.group_player.deleted_at === null ? 'text-danger' : 'text-accent'} disabled:opacity-40`}>
            {row.group_player.deleted_at === null ? 'DELETE' : 'REACTIVATE'}
          </button>
        </div>)}
      </div>

      <label className="text-xs text-muted tracking-widest block mb-3">ADD EXISTING PLAYER</label>
      <PlayerMultiSelect
        players={players}
        excludedIds={[...playerIds]}
        onAdd={addPlayers}
      />
      {error && <p className="text-xs text-danger mt-4">{error}</p>}
    </section>
  </>
}
