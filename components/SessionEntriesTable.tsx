'use client'

import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'
import {
  TableFooter,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table'

import BrowserTime from '@/components/BrowserTime'
import { Fragment, useState } from 'react'
import Link from 'next/link'
import ChipValue from '@/components/ChipValue'
import { toCny } from '@/lib/settlement'

interface Entry {
  id: string
  player_id: string
  chips: number
  final_chips: number | null
  total_buyin: number
  buy_ins: { amount: number; created_at: string }[]
  players?: { name: string } | null
}

export default function SessionEntriesTable({
  groupId,
  entries,
  exchangeRate,
  total,
}: {
  groupId: string
  entries: Entry[]
  exchangeRate: number
  total: number
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Table className="w-full text-sm">
      <TableHeader>
        <TableRow className="border-b border-border text-muted-foreground text-xs tracking-normal">
          <TableHead className="text-left py-3 font-normal">PLAYER</TableHead>
          <TableHead className="text-right py-3 font-normal">CNY</TableHead>
          <TableHead className="text-right py-3 font-normal">CHIPS</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e) => {
          const open = expanded.has(e.id)
          return (
            <Fragment key={e.id}>
              <TableRow
                onClick={() => toggle(e.id)}
                className="border-b border-border hover:bg-muted transition-colors cursor-pointer"
              >
                <TableCell className="py-4">
                  <span className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${e.players?.name ?? e.player_id} buy-in history`}
                      aria-expanded={open}
                      onClick={(event) => {
                        event.stopPropagation()
                        toggle(e.id)
                      }}
                    >
                      <ChevronRight
                        className={`size-3 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
                      />
                    </Button>
                    <Link
                      href={`/groups/${groupId}/players/${e.player_id}`}
                      onClick={(ev) => ev.stopPropagation()}
                      className="hover:text-primary transition-colors"
                    >
                      {e.players?.name ?? e.player_id}
                    </Link>
                  </span>
                </TableCell>
                <TableCell className="py-4 text-right text-muted-foreground">
                  <ChipValue chips={toCny(e.chips, exchangeRate)} prefix="¥" />
                </TableCell>
                <TableCell className="py-4 text-right">
                  <ChipValue chips={e.chips} />
                </TableCell>
              </TableRow>
              {open && (
                <TableRow className="border-b border-border bg-muted/40">
                  <TableCell colSpan={3} className="py-3 px-1">
                    <div className="text-xs text-muted-foreground">
                      <p className="tracking-normal mb-2">BUY-INS</p>
                      {e.buy_ins.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {e.buy_ins.map((buyIn, index) => (
                            <div key={`${buyIn.created_at}-${index}`}>
                              <BrowserTime value={buyIn.created_at} /> · +
                              {buyIn.amount.toLocaleString()}
                            </div>
                          ))}
                        </div>
                      ) : (
                        '—'
                      )}
                    </div>
                    <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1 mt-3 text-xs text-muted-foreground">
                      <span>
                        <span className="tracking-normal mr-2">TOTAL</span>
                        {e.total_buyin.toLocaleString()}
                      </span>
                      <span>
                        <span className="tracking-normal mr-2">FINAL</span>
                        {e.final_chips != null
                          ? e.final_chips.toLocaleString()
                          : '—'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          )
        })}
      </TableBody>
      <TableFooter>
        <TableRow className="text-muted-foreground text-xs">
          <TableCell className="pt-4">SUM</TableCell>
          <TableCell />
          <TableCell className="pt-4 text-right">
            <ChipValue chips={total} />
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}
