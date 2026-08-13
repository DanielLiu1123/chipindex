'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'
import PlayerMultiSelect from '@/components/PlayerMultiSelect'
import { api, createPlayerInGroup } from '@/lib/client'
import type { Group, GroupPlayer, Player } from '@/types'

function byCreatedAt(
  a: { group_player: GroupPlayer },
  b: { group_player: GroupPlayer },
): number {
  return a.group_player.created_at.localeCompare(b.group_player.created_at)
    || a.group_player.id.localeCompare(b.group_player.id)
}

function formatJoinedAt(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value)).replace(',', '')
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
  const [addingNewPlayer, setAddingNewPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [playerToDelete, setPlayerToDelete] = useState<{ player: Player; group_player: GroupPlayer } | null>(null)
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

  function createPlayer(event: React.FormEvent) {
    event.preventDefault()
    const playerName = newPlayerName.trim()
    if (!playerName) return
    return run(async () => {
      const row = await createPlayerInGroup(group.id, playerName)
      setGroupPlayers(current => [...current, row].sort(byCreatedAt))
      setNewPlayerName('')
      setAddingNewPlayer(false)
    })
  }

  function deletePlayer(row: { player: Player; group_player: GroupPlayer }) {
    return run(async () => {
      await api<GroupPlayer>('DELETE', `/api/groups/${group.id}/group-players`, { player_id: row.player.id })
      setGroupPlayers(current => current.filter(item => item.group_player.id !== row.group_player.id))
    })
  }

  function confirmDeletePlayer() {
    if (!playerToDelete) return
    const row = playerToDelete
    setPlayerToDelete(null)
    return deletePlayer(row)
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
      <div className="overflow-x-auto mb-6 border border-border">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] text-muted tracking-widest">
              <th className="px-3 py-2 text-left font-normal">PLAYER</th>
              <th className="px-3 py-2 text-left font-normal">JOINED AT</th>
              <th className="px-3 py-2 text-right font-normal">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {groupPlayers.map(row => <tr key={row.group_player.id} className="border-b border-border last:border-b-0">
              <td className="px-3 py-2.5 text-white">
                <Link href={`/groups/${group.id}/players/${row.player.id}`}
                  className="hover:text-accent transition-colors">
                  {row.player.name}
                </Link>
              </td>
              <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted tabular-nums">{formatJoinedAt(row.group_player.created_at)}</td>
              <td className="px-3 py-2.5 text-right">
                <button onClick={() => setPlayerToDelete(row)} disabled={pending}
                  className="text-[10px] tracking-widest text-danger disabled:opacity-40">
                  DELETE
                </button>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>

      <label className="text-xs text-muted tracking-widest block mb-3">ADD PLAYER</label>
      <div className="flex flex-col gap-1.5">
        {addingNewPlayer && <form onSubmit={createPlayer}
          className="flex gap-2 items-center border border-accent/50 bg-surface/30 px-3 py-1.5">
          <input autoFocus type="text" value={newPlayerName} onChange={event => setNewPlayerName(event.target.value)}
            placeholder="new player name"
            className="flex-1 min-w-0 bg-transparent border-b border-accent text-white text-sm px-1 py-1.5 outline-none focus:border-white transition-colors placeholder:text-muted" />
          <button type="submit" disabled={pending || !newPlayerName.trim()}
            className="h-8 shrink-0 border border-border px-3 text-[10px] tracking-widest text-accent hover:border-accent disabled:opacity-40">
            ADD
          </button>
          <button type="button" onClick={() => { setAddingNewPlayer(false); setNewPlayerName('') }} disabled={pending}
            aria-label="cancel new player"
            className="w-8 h-8 shrink-0 flex items-center justify-center border border-transparent text-muted hover:text-danger hover:border-danger/40 hover:bg-danger/10 text-lg leading-none transition-colors disabled:opacity-40">×</button>
        </form>}
        <PlayerMultiSelect
          players={players}
          excludedIds={[...playerIds]}
          onAdd={addPlayers}
          onNew={() => setAddingNewPlayer(true)}
        />
      </div>
      {error && <p className="text-xs text-danger mt-4">{error}</p>}
    </section>
    <ConfirmModal
      open={playerToDelete !== null}
      title={`Delete ${playerToDelete?.player.name ?? 'player'} from group?`}
      description="This player will be removed from this group."
      onConfirm={confirmDeletePlayer}
      onCancel={() => setPlayerToDelete(null)}
    />
  </>
}
