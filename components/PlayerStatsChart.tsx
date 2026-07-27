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
  const [chartType, setChartType] = useState<'line' | 'candle'>('line')
  const positive = mode === 'cny' ? totalCny >= 0 : totalChips >= 0

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
              <div role="group" aria-label="Chart type" className="inline-flex border border-border">
                <button
                  type="button"
                  aria-pressed={chartType === 'line'}
                  onClick={() => setChartType('line')}
                  className={`h-7 min-w-16 px-2 text-xs tracking-widest transition-colors ${chartType === 'line' ? 'bg-surface text-white border-b-2 border-accent' : 'text-muted hover:text-white'}`}
                >
                  LINE
                </button>
                <button
                  type="button"
                  aria-pressed={chartType === 'candle'}
                  onClick={() => setChartType('candle')}
                  className={`h-7 min-w-16 px-2 text-xs tracking-widest transition-colors ${chartType === 'candle' ? 'bg-surface text-white border-b-2 border-accent' : 'text-muted hover:text-white'}`}
                >
                  CANDLE
                </button>
              </div>
              <div role="group" aria-label="Value unit" className="inline-flex border border-border">
                <button
                  type="button"
                  aria-pressed={mode === 'cny'}
                  onClick={() => setMode('cny')}
                  className={`h-7 min-w-16 px-2 text-xs tracking-widest transition-colors ${mode === 'cny' ? 'bg-surface text-white border-b-2 border-accent' : 'text-muted hover:text-white'}`}
                >
                  CNY
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'chips'}
                  onClick={() => setMode('chips')}
                  className={`h-7 min-w-16 px-2 text-xs tracking-widest transition-colors ${mode === 'chips' ? 'bg-surface text-white border-b-2 border-accent' : 'text-muted hover:text-white'}`}
                >
                  CHIPS
                </button>
              </div>
            </div>
          </div>
          <PlayerChart data={data} positive={positive} mode={mode} chartType={chartType} />
        </div>
      )}
    </>
  )
}
