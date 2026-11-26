'use client'

import { useState } from 'react'
import { ChevronDown, History } from 'lucide-react'
import BrowserTime from './BrowserTime'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './ui/dialog'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from './ui/dropdown-menu'
import { filteredEventText } from '@/lib/session-event-log'
import type { EventPlayer, SessionEvent } from '@/lib/domain-types'

export default function SessionEventLog({ events }: { events: SessionEvent[] }) {
  if (!events.length) return null
  return <Dialog>
    <DialogTrigger asChild>
      <Button size="sm" variant="outline" className="ml-auto shrink-0"><History aria-hidden="true" />EVENT LOG</Button>
    </DialogTrigger>
    <DialogContent aria-describedby={undefined} className="flex flex-col overflow-hidden inset-x-0 top-auto bottom-0 max-h-[82dvh] max-sm:has([data-slot=dropdown-menu-trigger]):h-[82dvh] max-w-full translate-x-0 translate-y-0 rounded-b-none sm:left-auto sm:top-0 sm:h-dvh sm:max-h-dvh sm:max-w-[420px] sm:rounded-none">
      <DialogTitle className="sr-only">Event log</DialogTitle>
      <LogEntries events={events} />
    </DialogContent>
  </Dialog>
}

function LogEntries({ events }: { events: SessionEvent[] }) {
  const [selected, setSelected] = useState(new Set<string>())
  const players = new Map<string, EventPlayer>()
  for (const event of events) {
    if (event.player) players.set(event.player.id, event.player)
    for (const player of event.opening ?? []) players.set(player.id, player)
  }

  function toggle(id: string) {
    setSelected(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return <>
    {players.size > 0 && <div className="flex shrink-0 items-center gap-2 pr-8">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {selected.size ? `PLAYERS · ${selected.size}` : 'ALL PLAYERS'}<ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" aria-label="Players" className="w-52 max-h-[min(50dvh,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto">
          {[...players.values()].sort((a, b) => a.name.localeCompare(b.name)).map(player =>
            <DropdownMenuCheckboxItem className="min-h-9" key={player.id} checked={selected.has(player.id)}
              onSelect={event => event.preventDefault()} onCheckedChange={() => toggle(player.id)}>
              {player.name}
            </DropdownMenuCheckboxItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
      {selected.size > 0 && <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear</Button>}
    </div>}
    <ol className={`${players.size ? '' : 'mt-7'} min-h-0 overflow-y-auto overscroll-contain divide-y`}>
      {events.map(event => {
        const text = filteredEventText(event, selected)
        return text && <li key={event.id} className="flex items-baseline gap-3 py-3">
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground"><BrowserTime value={event.time} /></span>
          <span>{text}</span>
        </li>
      })}
    </ol>
  </>
}
