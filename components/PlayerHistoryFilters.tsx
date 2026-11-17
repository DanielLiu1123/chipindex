'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ListFilter, X } from 'lucide-react'
import Dialog from '@/components/Dialog'
import LeaderboardDateFilter from '@/components/LeaderboardDateFilter'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import type { LeaderboardFilter } from '@/lib/leaderboard-range'
import { matchesPlayerAttendance, playerHistoryFilterParams, type PlayerAttendanceRules } from '@/lib/player-history-filters'
import { sessionPageHref } from '@/lib/session-pagination'

const modes = ['include', 'exclude'] as const

export default function PlayerHistoryFilters({ path, pageSize, date, attendance, players, lineups }: {
  path: string
  pageSize: number
  date: LeaderboardFilter
  attendance: PlayerAttendanceRules
  players: { id: string; name: string }[]
  lineups: string[][]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<PlayerAttendanceRules>({})
  const dialogBody = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const count = Object.keys(attendance).length
  const needle = search.trim().toLocaleLowerCase()
  const visiblePlayers = players.filter(player => player.name.toLocaleLowerCase().includes(needle))
  const draftRules = Object.entries(draft)
  const matches = open ? lineups.filter(ids => matchesPlayerAttendance(ids, draftRules)).length : 0

  function apply(nextDate: LeaderboardFilter, nextAttendance: PlayerAttendanceRules) {
    if (pending) return
    const params = playerHistoryFilterParams(nextDate, nextAttendance)
    startTransition(() => router.push(sessionPageHref(path, 1, pageSize, params), { scroll: false }))
  }

  function editPlayers() {
    if (pending) return
    setDraft(attendance)
    setSearch('')
    setOpen(true)
  }

  return (
    <div className="mb-5" aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-2">
        <LeaderboardDateFilter filter={date} onChange={next => apply(next, attendance)} />
        <Button ref={trigger} type="button" variant="outline" className="h-8 gap-1.5 px-2.5 text-xs"
          aria-haspopup="dialog" aria-disabled={pending} onClick={editPlayers} disabled={players.length === 0}>
          <ListFilter className="size-3.5" /> FILTER PLAYERS{count > 0 && ` · ${count}`}
        </Button>
      </div>
      {modes.map(mode => {
        const selected = players.filter(player => attendance[player.id] === mode)
        if (!selected.length) return null
        return <div key={mode} className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs uppercase text-muted-foreground">{mode}</span>
          {selected.map(player => (
            <Button key={player.id} type="button" variant="outline" size="sm" disabled={pending}
              className="min-w-0 max-w-full" aria-label={`Remove ${mode} filter for ${player.name}`}
              onClick={() => {
                const next = { ...attendance }
                delete next[player.id]
                apply(date, next)
                trigger.current?.focus()
              }}>
              <span className="truncate">{player.name}</span><X aria-hidden="true" />
            </Button>
          ))}
        </div>
      })}

      <Dialog open={open} onClose={() => setOpen(false)} label="FILTER PLAYERS" initialFocusRef={dialogBody}>
        <div ref={dialogBody} tabIndex={-1} className="min-w-0 outline-none">
          <p className="mb-3 text-xs text-muted-foreground">Included players must all be present. Excluded players must all be absent.</p>
          <Input type="search" placeholder="Search players…" aria-label="Search players"
            value={search} onChange={event => setSearch(event.target.value)} />
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_4rem_4rem] items-center border-b pb-2 text-center text-[11px] text-muted-foreground" aria-hidden="true">
            <span className="text-left">PLAYER</span><span>INCLUDE</span><span>EXCLUDE</span>
          </div>
          <div className="max-h-[min(15rem,35dvh)] overflow-y-auto">
            {visiblePlayers.map(player => (
              <div key={player.id} className="grid min-h-11 grid-cols-[minmax(0,1fr)_4rem_4rem] items-center border-b">
                <span className="wrap-anywhere py-2 pr-2">{player.name}</span>
                {modes.map(mode => (
                  <Checkbox key={mode} className="justify-self-center" aria-label={`${mode === 'include' ? 'Include' : 'Exclude'} ${player.name}`}
                    checked={draft[player.id] === mode} onCheckedChange={checked => {
                      setDraft(current => {
                        const next = { ...current }
                        if (checked) next[player.id] = mode
                        else delete next[player.id]
                        return next
                      })
                    }} />
                ))}
              </div>
            ))}
            {!visiblePlayers.length && <p className="py-4 text-xs text-muted-foreground">No matching players.</p>}
          </div>
          <div className="mt-4 flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setDraft({})} disabled={!draftRules.length}>CLEAR</Button>
            <Button type="button" onClick={() => { setOpen(false); apply(date, draft) }}>
              APPLY · {matches} {matches === 1 ? 'SESSION' : 'SESSIONS'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
