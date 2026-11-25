'use client'

import { History } from 'lucide-react'
import BrowserTime from './BrowserTime'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './ui/dialog'
import type { SessionEvent } from '@/lib/domain-types'

export default function SessionEventLog({ events }: { events: SessionEvent[] }) {
  if (!events.length) return null
  return <Dialog>
    <DialogTrigger asChild>
      <Button size="sm" variant="outline" className="ml-auto shrink-0"><History aria-hidden="true" />EVENT LOG</Button>
    </DialogTrigger>
    <DialogContent aria-describedby={undefined} className="inset-x-0 top-auto bottom-0 max-h-[82dvh] max-w-full translate-x-0 translate-y-0 rounded-b-none sm:left-auto sm:top-0 sm:h-dvh sm:max-h-dvh sm:max-w-[420px] sm:rounded-none">
      <DialogTitle className="sr-only">Event log</DialogTitle>
      <ol className="mt-7 min-h-0 overflow-y-auto divide-y">
        {events.map(event => <li key={event.id} className="flex items-baseline gap-3 py-3">
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground"><BrowserTime value={event.time} /></span>
          <span>{event.text}</span>
        </li>)}
      </ol>
    </DialogContent>
  </Dialog>
}
