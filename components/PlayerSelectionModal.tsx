'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

import { Checkbox } from '@/components/ui/checkbox'
import { errorMessage } from '@/lib/error-message'
import { useId, useRef, useState, type FormEvent } from 'react'
import Dialog from './Dialog'
import { MAX_BUY_IN_AMOUNT } from '@/lib/buy-in-policy'
import { PLAYER_PAGE_SIZE, type SelectablePlayer } from '@/lib/player-selection'
import { usePlayerAction, type PlayerAction } from '@/lib/use-player-action'

interface Props {
  open: boolean
  participants: SelectablePlayer[]
  picker?: 'available' | 'session'
  action: PlayerAction
  onCreatePlayer?: (name: string) => Promise<SelectablePlayer>
  onClose: () => void
}

export default function PlayerSelectionModal({
  open,
  participants,
  picker = 'available',
  action,
  onCreatePlayer,
  onClose,
}: Props) {
  const busy = useRef(false)
  const id = useId()
  const [selected, setSelected] = useState<string[]>([])
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newError, setNewError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const [visibleCount, setVisibleCount] = useState(PLAYER_PAGE_SIZE)
  const [query, setQuery] = useState('')

  const chosen = participants.filter(
    (p) => selected.includes(p.player_id) && p.settled_at === null,
  )
  const submission = usePlayerAction(action, chosen)
  const { value, setValue, amount, valid, pending, error, retrying } =
    submission
  const locked = creating || submission.locked
  const addingPlayers = picker === 'available'
  const amountId = `${id}-amount`
  const search = query.trim().toLowerCase()
  const visiblePlayers = !addingPlayers
    ? participants.filter((player) => player.settled_at === null)
    : search
      ? participants.filter((player) =>
          player.name.toLowerCase().includes(search),
        )
      : participants.slice(0, visibleCount)

  function resetSelection() {
    setSelected([])
    setAddingNew(false)
    setNewName('')
    setNewError('')
    setVisibleCount(PLAYER_PAGE_SIZE)
    setQuery('')
  }

  function close() {
    if (busy.current || submission.isBusy()) return
    if (submission.reset()) resetSelection()
    onClose()
  }

  async function createPlayer() {
    const name = newName.trim()
    if (
      !name ||
      !onCreatePlayer ||
      busy.current ||
      submission.isBusy() ||
      locked
    )
      return
    busy.current = true
    setCreating(true)
    setNewError('')
    try {
      const player = await onCreatePlayer(name)
      setSelected((ids) =>
        ids.includes(player.player_id) ? ids : [...ids, player.player_id],
      )
      // A matching existing player may be beyond the currently visible page.
      const index = participants.findIndex(
        (p) => p.player_id === player.player_id,
      )
      if (index >= visibleCount)
        setVisibleCount(
          Math.ceil((index + 1) / PLAYER_PAGE_SIZE) * PLAYER_PAGE_SIZE,
        )
      setAddingNew(false)
      setNewName('')
      setQuery('')
    } catch (e) {
      setNewError(errorMessage(e))
    } finally {
      busy.current = false
      setCreating(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy.current || (addingNew && newName.trim())) return
    if (await submission.submit()) {
      resetSelection()
      onClose()
    }
  }

  return (
    <Dialog
      open={open}
      initialFocusRef={addingPlayers ? formRef : undefined}
      label={addingPlayers ? 'Add players' : 'Buy in'}
      pending={creating || pending}
      onClose={close}
    >
      {/* Receive initial dialog focus without adding a Tab stop before search. */}
      <form
        ref={formRef}
        tabIndex={addingPlayers ? -1 : undefined}
        onSubmit={submit}
        className="outline-none"
      >
        {addingPlayers && (
          <Input
            id={`${id}-search`}
            type="search"
            aria-label="Search players"
            placeholder="Search players..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault()
            }}
            className="mb-3 w-full"
          />
        )}
        <div
          role="group"
          aria-label={addingPlayers ? 'Available players' : 'Session players'}
          className="flex max-h-56 flex-wrap gap-2 overflow-y-auto"
        >
          {visiblePlayers.map((p) => (
            <Label
              key={p.player_id}
              className={`inline-flex rounded-lg min-h-10 max-w-full items-center gap-2 border px-2.5 py-2 text-xs transition-colors ${p.settled_at !== null ? 'border-border text-muted-foreground' : selected.includes(p.player_id) ? 'cursor-pointer border-primary/60 bg-primary/10 text-primary' : 'cursor-pointer border-border hover:border-ring/40 hover:bg-foreground/5'}`}
            >
              <Checkbox
                checked={selected.includes(p.player_id)}
                disabled={locked || p.settled_at !== null}
                onCheckedChange={() =>
                  setSelected((ids) =>
                    ids.includes(p.player_id)
                      ? ids.filter((id) => id !== p.player_id)
                      : [...ids, p.player_id],
                  )
                }
              />
              <span className="min-w-0 break-words">{p.name}</span>
              {p.settled_at !== null && (
                <span className="text-xs text-muted-foreground">
                  CASHED OUT
                </span>
              )}
            </Label>
          ))}
          {addingPlayers && !search && visibleCount < participants.length && (
            <Button
              variant="outline"
              type="button"
              aria-label="Show 10 more players"
              onClick={() =>
                setVisibleCount((count) => count + PLAYER_PAGE_SIZE)
              }
            >
              …
            </Button>
          )}
          {visiblePlayers.length === 0 && (
            <p className="p-4 text-xs text-muted-foreground">
              {addingPlayers
                ? search
                  ? 'No matching players.'
                  : 'No available players.'
                : 'No active session players.'}
            </p>
          )}
        </div>
        {addingPlayers &&
          onCreatePlayer &&
          (addingNew ? (
            <div className="mt-3 border border-border p-3">
              <Input
                id={`${id}-name`}
                type="text"
                aria-label="New player name"
                placeholder="Player name"
                autoFocus
                value={newName}
                disabled={locked}
                onChange={(event) => setNewName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void createPlayer()
                  }
                }}
                className="w-full min-w-0"
              />
              {newError && (
                <Alert variant="destructive">
                  <AlertDescription>{newError}</AlertDescription>
                </Alert>
              )}
              <div className="mt-3 flex justify-end gap-3">
                <Button
                  variant="ghost"
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    setAddingNew(false)
                    setNewName('')
                    setNewError('')
                  }}
                >
                  CANCEL
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  disabled={locked || !newName.trim()}
                  onClick={() => {
                    void createPlayer()
                  }}
                >
                  {creating ? 'CREATING...' : 'CREATE'}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              type="button"
              disabled={locked}
              onClick={() => {
                setNewName(query.trim())
                setAddingNew(true)
              }}
              className="mt-3"
            >
              + NEW PLAYER
            </Button>
          ))}
        {action.kind !== 'players' && (
          <>
            <Label
              htmlFor={amountId}
              className="mb-2 mt-5 block text-xs tracking-normal text-muted-foreground"
            >
              CHIPS PER PLAYER
            </Label>
            <div className="mb-2 flex gap-2">
              {[action.unit, action.unit * 2, action.unit * 3].map((preset) => (
                <Button
                  variant={amount === preset ? 'default' : 'outline'}
                  key={preset}
                  type="button"
                  disabled={locked}
                  aria-pressed={amount === preset}
                  onClick={() => setValue(String(preset))}
                >
                  {preset.toLocaleString()}
                </Button>
              ))}
            </div>
            <Input
              id={amountId}
              type="number"
              inputMode="numeric"
              min="1"
              max={MAX_BUY_IN_AMOUNT}
              step="1"
              value={value}
              disabled={locked}
              onChange={(e) => setValue(e.target.value)}
              className="w-full"
            />
          </>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
              {retrying &&
                ' Retry this same request before starting another buy-in.'}
            </AlertDescription>
          </Alert>
        )}
        <Button
          variant="default"
          type="submit"
          disabled={
            pending ||
            creating ||
            (addingNew && !!newName.trim()) ||
            (!retrying && !valid)
          }
          className="mt-5 w-full"
        >
          {pending
            ? 'SAVING...'
            : retrying
              ? 'RETRY'
              : addingPlayers
                ? 'ADD'
                : 'BUY IN'}
        </Button>
      </form>
    </Dialog>
  )
}
