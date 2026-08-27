'use client'

import { useState } from 'react'
import ChipValue from '@/components/ChipValue'
import PlayerChart from '@/components/PlayerChart'
import PlayerNameEditor from '@/components/PlayerNameEditor'
import type { HistoryPoint } from '@/lib/stats'

export default function PlayerStatsChart({
  groupId,
  id,
  initialName,
  data,
  totalCny,
  totalChips,
  sessions,
  wins,
  pogCount,
}: {
  groupId: string
  id: string
  initialName: string
  data: HistoryPoint[]
  totalCny: number
  totalChips: number
  sessions: number
  wins: number
  pogCount: number
}) {
  const [mode, setMode] = useState<'chips' | 'cny'>('cny')

  return (
    <>
      <section aria-label="Player summary" className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
        <PlayerNameEditor groupId={groupId} id={id} initialName={initialName} />
        <dl className="grid w-full grid-cols-2 gap-x-6 gap-y-3 text-xs sm:flex sm:w-auto sm:items-baseline sm:gap-6">
          <div><dt className="text-[9px] tracking-widest text-muted sm:sr-only">SESSIONS</dt><dd className="text-muted">{sessions} sessions</dd></div>
          <div className="text-right sm:text-left"><dt className="text-[9px] tracking-widest text-muted sm:sr-only">WINS</dt><dd className="text-muted">{wins} wins</dd></div>
          <div><dt className="text-[9px] tracking-widest text-muted sm:sr-only">POG</dt><dd className="text-muted">{pogCount} pog</dd></div>
          <div className="text-right sm:text-left">
            <dt className="text-[9px] tracking-widest text-muted sm:sr-only">TOTAL</dt>
            <dd>{mode === 'cny' ? (
              <ChipValue chips={totalCny} prefix="¥" className="text-sm" />
            ) : (
              <ChipValue chips={totalChips} className="text-sm" />
            )}</dd>
          </div>
        </dl>
      </section>

      {data.length > 0 && (
        <div className="mb-10 -mx-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 mx-2">
            <p className="text-xs text-muted tracking-widest">
              {mode === 'cny' ? 'CUMULATIVE CNY' : 'CUMULATIVE CHIPS'}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <div role="group" aria-label="Value unit" className="flex gap-3">
                <button
                  type="button"
                  aria-pressed={mode === 'cny'}
                  onClick={() => setMode('cny')}
                  className={`inline-flex min-h-11 items-center text-xs tracking-widest transition-colors sm:min-h-0 ${mode === 'cny' ? 'text-white' : 'text-muted hover:text-white'}`}
                >
                  CNY
                </button>
                <span aria-hidden="true" className="text-muted text-xs">/</span>
                <button
                  type="button"
                  aria-pressed={mode === 'chips'}
                  onClick={() => setMode('chips')}
                  className={`inline-flex min-h-11 items-center text-xs tracking-widest transition-colors sm:min-h-0 ${mode === 'chips' ? 'text-white' : 'text-muted hover:text-white'}`}
                >
                  CHIPS
                </button>
              </div>
            </div>
          </div>
          <PlayerChart groupId={groupId} data={data} mode={mode} />
        </div>
      )}
    </>
  )
}
