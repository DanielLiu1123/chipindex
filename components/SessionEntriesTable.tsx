'use client'

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
                  <ChipValue chips={toCny(e.chips, exchangeRate)} prefix="¥" />
                </td>
                <td className="py-4 text-right">
                  <ChipValue chips={e.chips} />
                </td>
              </tr>
              {open && (
                <tr className="border-b border-border bg-surface/40">
                  <td colSpan={3} className="py-3 px-1">
                    <div className="text-xs text-muted">
                      <p className="tracking-widest mb-2">BUY-INS</p>
                      {e.buy_ins.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {e.buy_ins.map((buyIn, index) => (
                            <div key={`${buyIn.created_at}-${index}`}>
                              {new Date(buyIn.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · +{buyIn.amount.toLocaleString()}
                            </div>
                          ))}
                        </div>
                      ) : '—'}
                    </div>
                    <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1 mt-3 text-xs text-muted">
                      <span>
                        <span className="tracking-widest mr-2">TOTAL</span>
                        {e.total_buyin.toLocaleString()}
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
