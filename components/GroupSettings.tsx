'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'
import BuyInModal from '@/components/BuyInModal'
import { addGroupPlayer, createPlayerInGroup, deleteGroupPlayer, renameGroup } from '@/lib/client'
import type { Group, GroupPlayer, Player } from '@/lib/domain-types'

function byJoinedAt(
  a: { player: Player; group_player: GroupPlayer },
  b: { player: Player; group_player: GroupPlayer },
): number {
  return a.group_player.created_at.localeCompare(b.group_player.created_at)
    || a.player.id.localeCompare(b.player.id)
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
  const [addPlayersOpen, setAddPlayersOpen] = useState(false)
  const [createdPlayers, setCreatedPlayers] = useState<Player[]>([])
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
      const updated = await renameGroup(group.id, name)
      setName(updated.name)
      setSavedName(updated.name)
      window.dispatchEvent(new Event('chipindex:groups-changed'))
    })
  }

  async function addPlayers(ids: string[]) {
    setPending(true)
    try {
      for (const playerId of ids) {
        if (playerIds.has(playerId)) continue
        const player = players.find(item => item.id === playerId)
        if (!player) throw new Error('Player not found')
        const group_player = await addGroupPlayer(group.id, playerId)
        setGroupPlayers(current => [...current.filter(row => row.player.id !== playerId), { player, group_player }].sort(byJoinedAt))
      }
    } finally {
      setPending(false)
      router.refresh()
    }
  }

  async function createPlayer(playerName: string) {
    const existing = [...createdPlayers, ...players].find(player => player.name.trim().toLowerCase() === playerName.trim().toLowerCase())
    if (existing) {
      if (playerIds.has(existing.id) && !createdPlayers.some(player => player.id === existing.id)) throw new Error('This player is already in the group.')
      return { player_id: existing.id, name: existing.name, settled_at: null }
    }
    setPending(true)
    try {
      const row = await createPlayerInGroup(group.id, playerName.trim())
      setGroupPlayers(current => [...current, row].sort(byJoinedAt))
      setCreatedPlayers(current => [row.player, ...current])
      router.refresh()
      return { player_id: row.player.id, name: row.player.name, settled_at: null }
    } finally { setPending(false) }
  }

  function deletePlayer(row: { player: Player; group_player: GroupPlayer }) {
    return run(async () => {
      await deleteGroupPlayer(group.id, row.player.id)
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
    <div className="max-w-3xl">
      <section aria-label="Group name" className="mb-8 border border-border bg-surface/60 p-4 sm:p-5">
        <form onSubmit={event => { event.preventDefault(); if (!pending && name.trim() && name.trim() !== savedName) void rename() }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <label htmlFor="group-name" className="shrink-0 text-[10px] tracking-widest text-white/50">GROUP NAME</label>
          <div className="flex min-w-0 flex-1 gap-2">
            <input id="group-name" value={name} disabled={pending} onChange={event => setName(event.target.value)}
              className="min-w-0 flex-1 border border-border bg-bg px-3 py-2 text-sm text-white outline-none transition-colors focus:border-white/60 disabled:opacity-50" />
            <button type="submit" disabled={pending || !name.trim() || name.trim() === savedName}
              className="shrink-0 border border-white/20 bg-white/5 px-4 py-2 text-[10px] tracking-widest text-white transition-colors hover:enabled:border-white/50 hover:enabled:bg-white/10 disabled:opacity-30">SAVE</button>
          </div>
        </form>
      </section>

      <section aria-labelledby="group-players-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h2 id="group-players-heading" className="text-xs tracking-widest text-white">PLAYERS</h2>
            <span className="border border-border bg-surface px-2 py-0.5 text-[10px] tabular-nums text-white/50">{groupPlayers.length}</span>
          </div>
          <button type="button" disabled={pending} onClick={() => setAddPlayersOpen(true)}
            className="shrink-0 border border-sky-300/25 bg-sky-300/[0.06] px-4 py-2.5 text-center text-xs font-medium tracking-widest text-sky-300 transition-colors hover:enabled:border-sky-300/45 hover:enabled:bg-sky-300/10 disabled:opacity-40">
            + PLAYER
          </button>
        </div>

        <div className="border border-border">
          <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_11rem_5rem] gap-4 border-b border-border bg-surface/60 px-4 py-2.5 text-[10px] tracking-widest text-white/40 sm:grid">
            <span>PLAYER</span><span>JOINED AT</span><span />
          </div>
          <ul className="divide-y divide-border">
            {groupPlayers.map(row => <li key={row.group_player.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-2.5 transition-colors hover:bg-white/[0.025] sm:grid-cols-[minmax(0,1fr)_11rem_5rem] sm:py-2">
              <Link href={`/groups/${group.id}/players/${row.player.id}`} title={row.player.name}
                className="min-w-0 truncate text-sm text-white transition-colors hover:text-accent focus-visible:outline-accent">
                {row.player.name}
              </Link>
              <time dateTime={row.group_player.created_at} aria-label={`Joined ${formatJoinedAt(row.group_player.created_at)}`}
                className="col-start-1 row-start-2 mt-1 text-[10px] tabular-nums text-white/40 sm:col-start-auto sm:row-start-auto sm:mt-0 sm:text-xs">
                {formatJoinedAt(row.group_player.created_at)}
              </time>
              <button type="button" onClick={() => setPlayerToDelete(row)} disabled={pending} aria-label={`Remove ${row.player.name} from group`}
                className="col-start-2 row-span-2 row-start-1 min-h-9 bg-[#211517] px-2 text-[10px] tracking-widest text-[#C58B91] transition-colors hover:enabled:bg-[#301C20] focus-visible:bg-[#301C20] focus-visible:outline-[#C58B91] disabled:opacity-40 sm:col-start-3 sm:row-span-1">
                REMOVE
              </button>
            </li>)}
          </ul>
          {groupPlayers.length === 0 && <p className="px-4 py-8 text-center text-xs text-white/40">No players yet.</p>}
        </div>
      </section>
      {error && <p role="alert" className="mt-4 text-xs text-danger">{error}</p>}
    </div>
    <BuyInModal open={addPlayersOpen} groupId={group.id} mode="group"
      participants={[...createdPlayers, ...players.filter(player => !playerIds.has(player.id) && !createdPlayers.some(created => created.id === player.id))]
        .map(player => ({ player_id: player.id, name: player.name, settled_at: null }))}
      onCreatePlayer={createPlayer} onAddPlayers={addPlayers}
      onClose={() => { setAddPlayersOpen(false); setCreatedPlayers([]) }} />
    <ConfirmModal
      open={playerToDelete !== null}
      title={`Remove ${playerToDelete?.player.name ?? 'player'} from group?`}
      confirmLabel="REMOVE"
      description="This player will be removed from this group."
      onConfirm={confirmDeletePlayer}
      onCancel={() => setPlayerToDelete(null)}
    />
  </>
}
