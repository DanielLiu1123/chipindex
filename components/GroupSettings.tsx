'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/client'
import type { Group, GroupPlayer, Player } from '@/types'

export default function GroupSettings({ group, initialGroupPlayers, playersAndGroups }: {
  group: Group
  initialGroupPlayers: Array<{ player: Player; group_player: GroupPlayer }>
  playersAndGroups: Array<{ player: Player; groups: Group[] }>
}) {
  const router = useRouter()
  const [name, setName] = useState(group.name)
  const [savedName, setSavedName] = useState(group.name)
  const [groupPlayers, setGroupPlayers] = useState(initialGroupPlayers)
  const [selectedId, setSelectedId] = useState('')
  const [newName, setNewName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const playerIds = useMemo(() => new Set(groupPlayers.map(row => row.player.id)), [groupPlayers])
  const available = playersAndGroups.filter(row => !playerIds.has(row.player.id))

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

  function addExisting() {
    const row = available.find(item => item.player.id === selectedId)
    if (!row) return
    return run(async () => {
      const group_player = await api<GroupPlayer>('POST', `/api/groups/${group.id}/group-players`, { player_id: row.player.id })
      setGroupPlayers(current => [...current, { player: row.player, group_player }]
        .sort((a, b) => a.player.name.localeCompare(b.player.name)))
      setSelectedId('')
    })
  }

  function createPlayer() {
    const trimmed = newName.trim()
    if (!trimmed) return
    return run(async () => {
      const row = await api<{ player: Player; group_player: GroupPlayer }>('POST', `/api/groups/${group.id}/players`, { name: trimmed })
      setGroupPlayers(current => [...current, row].sort((a, b) => a.player.name.localeCompare(b.player.name)))
      setNewName('')
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
    <div className="mb-6"><Link href={`/groups/${group.id}`} className="text-muted text-xs hover:text-white tracking-widest">← LEADERBOARD</Link></div>
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
      <h2 className="text-xs text-muted tracking-widest mb-3">MEMBERS</h2>
      <div className="flex flex-col gap-1 mb-6">
        {groupPlayers.map(row => <div key={row.group_player.id} className="flex items-center gap-3 border border-border px-3 py-2.5">
          <span className={`flex-1 ${row.group_player.deleted_at === null ? 'text-white' : 'text-muted'}`}>{row.player.name}</span>
          {row.group_player.deleted_at !== null && <span className="text-[10px] tracking-widest text-muted">INACTIVE</span>}
          <button onClick={() => setDeleted(row, row.group_player.deleted_at === null)} disabled={pending}
            className={`text-[10px] tracking-widest ${row.group_player.deleted_at === null ? 'text-danger' : 'text-accent'} disabled:opacity-40`}>
            {row.group_player.deleted_at === null ? 'DEACTIVATE' : 'REACTIVATE'}
          </button>
        </div>)}
      </div>

      <label className="text-xs text-muted tracking-widest block mb-2">ADD EXISTING PLAYER</label>
      <div className="flex gap-2 mb-5">
        <select value={selectedId} onChange={event => setSelectedId(event.target.value)} className="flex-1 bg-surface border border-border text-white text-sm px-3 py-2">
          <option value="">select player</option>
          {available.map(row => <option key={row.player.id} value={row.player.id}>
            {row.player.name}{row.groups.length ? ` · ${row.groups.map(item => item.name).join(', ')}` : ''}
          </option>)}
        </select>
        <button onClick={addExisting} disabled={pending || !selectedId} className="border border-border text-xs tracking-widest px-4 disabled:opacity-40 hover:border-white">ADD</button>
      </div>

      <label className="text-xs text-muted tracking-widest block mb-2">CREATE NEW PLAYER</label>
      <div className="flex gap-2">
        <input value={newName} onChange={event => setNewName(event.target.value)} placeholder="player name"
          className="flex-1 bg-surface border border-border text-white text-sm px-3 py-2 outline-none focus:border-white" />
        <button onClick={createPlayer} disabled={pending || !newName.trim()} className="border border-border text-xs tracking-widest px-4 disabled:opacity-40 hover:border-white">CREATE</button>
      </div>
      {error && <p className="text-xs text-danger mt-4">{error}</p>}
    </section>
  </>
}
