'use client'

import { Button } from '@/components/ui/button'
import { ChevronRight } from 'lucide-react'
import {
  TableFooter,
  TableHeader,
  TableRow,
  TableBody,
} from '@/components/ui/table'

import { ResponsiveTable, ResponsiveHead, ResponsiveCell, HiddenColumnDetail } from '@/components/ResponsiveTable'

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

const columns = [{ key: 'player', minWidth: 120, wrap: true, extraWidth: 20 }, { key: 'cny', minWidth: 104 }, { key: 'chips', minWidth: 96 }]
const hideOrder = ['chips']

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
    <ResponsiveTable columns={columns} hideOrder={hideOrder} className="text-sm [&_th]:px-2 [&_td]:px-2">
      <TableHeader>
        <TableRow className="border-b border-border text-muted-foreground text-xs tracking-normal">
          <ResponsiveHead column="player" className="px-3 text-left py-3 font-normal">PLAYER</ResponsiveHead>
          <ResponsiveHead column="cny" className="text-right py-3 font-normal">CNY</ResponsiveHead>
          <ResponsiveHead column="chips" className="text-right py-3 font-normal">CHIPS</ResponsiveHead>
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
                <ResponsiveCell column="player" className="py-4 whitespace-normal [overflow-wrap:anywhere]">
                  <span className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="w-3 shrink-0 border-0 p-0"
                      aria-label={`${e.players?.name ?? e.player_id} buy-in history`}
                      aria-expanded={open}
                      onClick={(event) => {
                        event.stopPropagation()
                        toggle(e.id)
                      }}
                    >
                      <ChevronRight
                        aria-hidden="true"
                        className={`size-3 text-muted-foreground transition-transform motion-reduce:transition-none ${open ? 'rotate-90' : ''}`}
                      />
                    </Button>
                    <Link
                      href={`/groups/${groupId}/players/${e.player_id}`}
                      onClick={(ev) => ev.stopPropagation()}
                      data-measure-text className="min-w-0 hover:text-primary transition-colors"
                    >
                      {e.players?.name ?? e.player_id}
                    </Link>
                  </span>
                </ResponsiveCell>
                <ResponsiveCell column="cny" className="py-4 text-right text-muted-foreground">
                  <ChipValue chips={toCny(e.chips, exchangeRate)} prefix="¥" />
                </ResponsiveCell>
                <ResponsiveCell column="chips" className="py-4 text-right">
                  <ChipValue chips={e.chips} />
                </ResponsiveCell>
              </TableRow>
              {open && (
                <TableRow className="border-b border-border bg-muted/40">
                  <ResponsiveCell span className="px-3 py-3">
                    <HiddenColumnDetail column="chips"><p className="mb-2 text-xs">CHIPS <ChipValue chips={e.chips} /></p></HiddenColumnDetail>
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
                  </ResponsiveCell>
                </TableRow>
              )}
            </Fragment>
          )
        })}
      </TableBody>
      {total !== 0 && (
        <TableFooter>
          <TableRow className="text-muted-foreground text-xs">
            <ResponsiveCell span className="pt-4 text-right whitespace-normal">
              <span>SUM</span> · <ChipValue chips={total} /> CHIPS
            </ResponsiveCell>
          </TableRow>
        </TableFooter>
      )}
    </ResponsiveTable>
  )
}
