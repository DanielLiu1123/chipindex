'use client'

import { useState } from 'react'
import PlayerChart from '@/components/PlayerChart'

interface Point {
  date: string
  chips: number
  cumulative: number
  cny: number
  cumulative_cny: number
}

export default function PlayerChartSection({ data, totalCny, totalChips }: {
  data: Point[]
  totalCny: number
  totalChips: number
}) {
  const [mode, setMode] = useState<'chips' | 'cny'>('cny')

  const positive = mode === 'cny' ? totalCny >= 0 : totalChips >= 0

  return (
    <div className="mb-10 -mx-2">
      <div className="flex items-center justify-between mb-4 mx-2">
        <p className="text-xs text-muted tracking-widest">
          {mode === 'cny' ? 'CUMULATIVE CNY' : 'CUMULATIVE CHIPS'}
        </p>
        <div className="flex gap-3">
          <button onClick={() => setMode('cny')}
            className={`text-xs tracking-widest transition-colors ${mode === 'cny' ? 'text-white' : 'text-muted hover:text-white'}`}>
            CNY
          </button>
          <span className="text-muted text-xs">/</span>
          <button onClick={() => setMode('chips')}
            className={`text-xs tracking-widest transition-colors ${mode === 'chips' ? 'text-white' : 'text-muted hover:text-white'}`}>
            CHIPS
          </button>
        </div>
      </div>
      <PlayerChart data={data} positive={positive} mode={mode} />
    </div>
  )
}
