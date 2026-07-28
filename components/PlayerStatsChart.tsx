'use client'

import { useState } from 'react'
import ChipValue from '@/components/ChipValue'
import PlayerChart from '@/components/PlayerChart'
import PlayerNameEditor from '@/components/PlayerNameEditor'
import type { HistoryPoint } from '@/lib/stats'

export default function PlayerStatsChart({
  id,
  initialName,
  data,
  totalCny,
  totalChips,
  sessions,
  wins,
  pogCount,
}: {
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
      <div className="flex items-baseline justify-between mb-8">
        <PlayerNameEditor id={id} initialName={initialName} />
        <div className="flex gap-6 text-xs text-muted items-baseline">
          <span>{sessions} sessions</span>
          <span>{wins} wins</span>
          <span>{pogCount} pog</span>
          {mode === 'cny' ? (
            <ChipValue chips={totalCny} prefix="¥" className="text-sm" />
          ) : (
            <ChipValue chips={totalChips} className="text-sm" />
          )}
        </div>
      </div>

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
                  className={`text-xs tracking-widest transition-colors ${mode === 'cny' ? 'text-white' : 'text-muted hover:text-white'}`}
                >
                  CNY
                </button>
                <span aria-hidden="true" className="text-muted text-xs">/</span>
                <button
                  type="button"
                  aria-pressed={mode === 'chips'}
                  onClick={() => setMode('chips')}
                  className={`text-xs tracking-widest transition-colors ${mode === 'chips' ? 'text-white' : 'text-muted hover:text-white'}`}
                >
                  CHIPS
                </button>
              </div>
            </div>
          </div>
          <PlayerChart data={data} mode={mode} />
        </div>
      )}
    </>
  )
}
