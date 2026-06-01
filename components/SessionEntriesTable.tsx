'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import ChipValue from '@/components/ChipValue'

interface Entry {
  id: string
  player_id: string
  chips: number
  final_chips: number | null
  total_buyin: number
  buy_ins: number[]
  players?: { name: string } | null
}

export default function SessionEntriesTable({ entries, exchangeRate, total }: {
  entries: Entry[]
  exchangeRate: number
  total: number
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-muted text-xs tracking-widest">
          <th className="text-left py-3 font-normal">PLAYER</th>
          <th className="text-right py-3 font-normal">CNY</th>
          <th className="text-right py-3 font-normal">CHIPS</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(e => {
          const open = expanded.has(e.id)
          return (
            <Fragment key={e.id}>
              <tr onClick={() => toggle(e.id)} className="border-b border-border hover:bg-surface transition-colors cursor-pointer">
                <td className="py-4">
                  <span className="flex items-center gap-2">
                    <svg className={`w-2.5 h-2.5 text-muted transition-transform ${open ? 'rotate-90' : ''}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <Link href={`/players/${e.player_id}`} onClick={ev => ev.stopPropagation()} className="hover:text-accent transition-colors">
                      {e.players?.name ?? e.player_id}
                    </Link>
                  </span>
                </td>
                <td className="py-4 text-right text-muted">
                  <ChipValue chips={Math.round(e.chips / exchangeRate)} prefix="¥" />
                </td>
                <td className="py-4 text-right">
                  <ChipValue chips={e.chips} />
                </td>
              </tr>
              {open && (
                <tr className="border-b border-border bg-surface/40">
                  <td colSpan={3} className="py-3 px-1">
                    <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1 text-xs text-muted">
                      <span>
                        <span className="tracking-widest mr-2">BUY-IN</span>
                        {e.buy_ins.length > 0 ? e.buy_ins.map(a => a.toLocaleString()).join(' · ') : '—'}
                        {e.buy_ins.length > 0 && <span className="ml-2">(total {e.total_buyin.toLocaleString()})</span>}
                      </span>
                      <span>
                        <span className="tracking-widest mr-2">FINAL</span>
                        {e.final_chips != null ? e.final_chips.toLocaleString() : '—'}
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
      <tfoot>
        <tr className="text-muted text-xs">
          <td className="pt-4">SUM</td>
          <td />
          <td className="pt-4 text-right"><ChipValue chips={total} /></td>
        </tr>
      </tfoot>
    </table>
  )
}
