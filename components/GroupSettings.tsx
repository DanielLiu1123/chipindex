'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/client'
import type { GroupMember } from '@/lib/queries'
import type { Player, PlayerGroup } from '@/types'

export default function GroupSettings({ group, initialMembers, globalPlayers }: {
  group: PlayerGroup
  initialMembers: GroupMember[]
  globalPlayers: GroupMember[]
}) {
  const router = useRouter()
  const [name, setName] = useState(group.name)
  const [savedName, setSavedName] = useState(group.name)
  const [members, setMembers] = useState(initialMembers)
  const [selectedId, setSelectedId] = useState('')
  const [newName, setNewName] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const memberIds = useMemo(() => new Set(members.map(member => member.id)), [members])
  const available = globalPlayers.filter(player => !memberIds.has(player.id))

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
      const updated = await api<PlayerGroup>('PATCH', `/api/groups/${group.id}`, { name })
      setName(updated.name)
      setSavedName(updated.name)
      window.dispatchEvent(new Event('chipindex:groups-changed'))
    })
  }

  function addExisting() {
    const player = available.find(item => item.id === selectedId)
    if (!player) return
    return run(async () => {
      await api('POST', `/api/groups/${group.id}/members`, { player_id: player.id })
      setMembers(current => [...current, { ...player, active: true }].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedId('')
    })
  }

  function createPlayer() {
    const trimmed = newName.trim()
    if (!trimmed) return
    return run(async () => {
      const player = await api<Player>('POST', `/api/groups/${group.id}/players`, { name: trimmed })
      setMembers(current => [...current, { ...player, active: true }].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName('')
    })
  }

  function setActive(player: GroupMember, active: boolean) {
    return run(async () => {
      await api('PATCH', `/api/groups/${group.id}/members`, { player_id: player.id, active })
      setMembers(current => current.map(item => item.id === player.id ? { ...item, active } : item))
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
        {members.map(member => <div key={member.id} className="flex items-center gap-3 border border-border px-3 py-2.5">
          <span className={`flex-1 ${member.active ? 'text-white' : 'text-muted'}`}>{member.name}</span>
          {!member.active && <span className="text-[10px] tracking-widest text-muted">INACTIVE</span>}
          <button onClick={() => setActive(member, !member.active)} disabled={pending}
            className={`text-[10px] tracking-widest ${member.active ? 'text-danger' : 'text-accent'} disabled:opacity-40`}>
            {member.active ? 'DEACTIVATE' : 'REACTIVATE'}
          </button>
        </div>)}
      </div>

      <label className="text-xs text-muted tracking-widest block mb-2">ADD EXISTING PLAYER</label>
      <div className="flex gap-2 mb-5">
        <select value={selectedId} onChange={event => setSelectedId(event.target.value)} className="flex-1 bg-surface border border-border text-white text-sm px-3 py-2">
          <option value="">select player</option>
          {available.map(player => <option key={player.id} value={player.id}>
            {player.name}{player.groups?.length ? ` · ${player.groups.map(item => item.name).join(', ')}` : ''}
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
