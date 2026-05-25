'use client'

import { useState } from 'react'
import ChipValue from '@/components/ChipValue'
import PlayerChart from '@/components/PlayerChart'
import PlayerNameEditor from '@/components/PlayerNameEditor'

interface Point {
  date: string
  session_id: string
  chips: number
  cumulative: number
  cny: number
  cumulative_cny: number
  description: string | null
}

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
  data: Point[]
  totalCny: number
  totalChips: number
  sessions: number
  wins: number
  pogCount: number
}) {
  const [mode, setMode] = useState<'chips' | 'cny'>('cny')
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

      {data.length > 1 && (
        <div className="mb-10 -mx-2">
          <div className="flex items-center justify-between mb-4 mx-2">
            <p className="text-xs text-muted tracking-widest">
              {mode === 'cny' ? 'CUMULATIVE CNY' : 'CUMULATIVE CHIPS'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setMode('cny')}
                className={`text-xs tracking-widest transition-colors ${mode === 'cny' ? 'text-white' : 'text-muted hover:text-white'}`}
              >
                CNY
              </button>
              <span className="text-muted text-xs">/</span>
              <button
                onClick={() => setMode('chips')}
                className={`text-xs tracking-widest transition-colors ${mode === 'chips' ? 'text-white' : 'text-muted hover:text-white'}`}
              >
                CHIPS
              </button>
            </div>
          </div>
          <PlayerChart data={data} positive={positive} mode={mode} />
        </div>
      )}
    </>
  )
}
