'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import { errorMessage } from '@/lib/error-message'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BrowserTime from '@/components/BrowserTime'
import ConfirmModal from '@/components/ConfirmModal'
import PlayerSelectionModal from '@/components/PlayerSelectionModal'
import PlayerActionButton from '@/components/PlayerActionButton'
import { addGroupPlayer, deleteGroupPlayer, renameGroup } from '@/lib/client'
import { usePlayerDirectory } from '@/lib/use-player-directory'
import type { Group, GroupPlayer, Player } from '@/lib/domain-types'

function byJoinedAt(
  a: { player: Player; group_player: GroupPlayer },
  b: { player: Player; group_player: GroupPlayer },
): number {
  return a.group_player.created_at.localeCompare(b.group_player.created_at)
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
  const [addPlayersOpen, setAddPlayersOpen] = useState(false)
  const [playerToDelete, setPlayerToDelete] = useState<{ player: Player; group_player: GroupPlayer } | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const playerIds = useMemo(() => new Set(groupPlayers.map(row => row.player.id)), [groupPlayers])
  const directory = usePlayerDirectory({ groupId: group.id, players, excludedIds: [...playerIds],
    excludedMessage: 'This player is already in the group.', retainCreatedSelections: true,
    onCreated: row => {
      setGroupPlayers(current => [...current.filter(item => item.player.id !== row.player.id), row].sort(byJoinedAt))
      router.refresh()
    } })

  async function run(action: () => Promise<void>) {
    setPending(true)
    setError('')
    try {
      await action()
      router.refresh()
    } catch (reason) {
      setError(errorMessage(reason))
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
        const player = directory.players.find(item => item.id === playerId)
        if (!player) throw new Error('Player not found')
        const group_player = await addGroupPlayer(group.id, playerId)
        setGroupPlayers(current => [...current.filter(row => row.player.id !== playerId), { player, group_player }].sort(byJoinedAt))
      }
    } finally {
      setPending(false)
      router.refresh()
    }
  }

  async function confirmDeletePlayer() {
    if (!playerToDelete) return
    const row = playerToDelete
    await deleteGroupPlayer(group.id, row.player.id)
    setGroupPlayers(current => current.filter(item => item.group_player.id !== row.group_player.id))
    setPlayerToDelete(null)
    router.refresh()
  }

  return <>
    <div className="space-y-6">
      <section aria-label="Group name" className="rounded-xl border border-border bg-card p-5 sm:p-6">
        <form onSubmit={event => { event.preventDefault(); if (!pending && name.trim() && name.trim() !== savedName) void rename() }}
          className="space-y-4">
          <Label htmlFor="group-name" className="text-sm font-semibold tracking-wide text-foreground">GROUP NAME</Label>
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Input id="group-name" value={name} disabled={pending} onChange={event => setName(event.target.value)}
              className="min-w-0 flex-1 bg-background" />
            <Button variant="default" type="submit" disabled={pending || !name.trim() || name.trim() === savedName}
              className="w-24 shrink-0 text-xs tracking-wide">SAVE</Button>
          </div>
        </form>
      </section>

      <section aria-labelledby="group-players-heading" className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <h2 id="group-players-heading" className="text-sm font-semibold tracking-wide text-foreground">PLAYERS</h2>
            <span className="inline-flex min-w-6 items-center justify-center rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{groupPlayers.length}</span>
          </div>
          <PlayerActionButton action="add-player" className="w-24 text-xs tracking-wide" disabled={pending} onClick={() => setAddPlayersOpen(true)} />
        </div>

        <div>
          <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_11rem_6rem] gap-4 border-b border-border bg-muted/40 px-6 py-3 text-[10px] font-medium tracking-widest text-muted-foreground sm:grid">
            <span>PLAYER</span><span>JOINED AT</span><span />
          </div>
          <ul className="divide-y divide-border">
            {groupPlayers.map(row => <li key={row.group_player.id}
              className="grid min-h-18 grid-cols-[minmax(0,1fr)_6rem] items-center gap-x-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:grid-cols-[minmax(0,1fr)_11rem_6rem] sm:gap-x-4 sm:px-6">
              <Link href={`/groups/${group.id}/players/${row.player.id}`} title={row.player.name}
                className="min-w-0 truncate text-sm font-medium text-foreground underline-offset-4 transition-colors hover:underline focus-visible:outline-ring">
                {row.player.name}
              </Link>
              <span aria-label={`Joined time for ${row.player.name}`}
                className="col-start-1 row-start-2 mt-1 text-xs tabular-nums text-muted-foreground sm:col-start-2 sm:row-start-1 sm:mt-0">
                <BrowserTime value={row.group_player.created_at} includeDate />
              </span>
              <Button variant="ghost" className="col-start-2 row-span-2 row-start-1 w-24 text-xs tracking-wide text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:col-start-3 sm:row-span-1" type="button" onClick={() => setPlayerToDelete(row)} disabled={pending} aria-label={`Remove ${row.player.name} from group`}
                >
                REMOVE
              </Button>
            </li>)}
          </ul>
          {groupPlayers.length === 0 && <p className="px-5 py-12 text-center text-sm text-muted-foreground">No players yet.</p>}
        </div>
      </section>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    </div>
    <PlayerSelectionModal open={addPlayersOpen} participants={directory.participants}
      onCreatePlayer={directory.create} action={{ kind: 'players', submit: addPlayers }}
      onClose={() => { setAddPlayersOpen(false); directory.resetSelection() }} />
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
