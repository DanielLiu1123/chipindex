'use client'

import ValueUnitControl from '@/components/ValueUnitControl'
import { useState, type ReactNode } from 'react'
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
  filters,
  analysis,
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
  filters?: ReactNode
  analysis?: { losses: number; ties: number }
}) {
  const [mode, setMode] = useState<'chips' | 'cny'>('cny')
  const total = mode === 'cny' ? totalCny : totalChips
  const prefix = mode === 'cny' ? '¥' : undefined

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-4 mb-4">
        <PlayerNameEditor groupId={groupId} id={id} initialName={initialName} />
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground items-baseline" aria-live="polite">
          <span>{sessions} {analysis ? 'matching sessions' : 'sessions'}</span>
          <span>{wins} wins</span>
          {analysis ? (
            <><span>{analysis.losses} losses</span><span>{analysis.ties} ties</span></>
          ) : <span>{pogCount} pog</span>}
          {analysis && sessions === 0 ? <span>—</span> : <ChipValue chips={total} prefix={prefix} className="text-sm" />}
          {analysis && sessions > 0 && (
            <span><ChipValue chips={total / sessions} prefix={prefix} /> / session</span>
          )}
        </div>
      </div>

      {filters}

      {data.length > 0 && (
        <div className="surface mb-10 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 mx-2">
            <p className="text-xs text-muted-foreground tracking-normal">
              {mode === 'cny' ? 'CUMULATIVE CNY' : 'CUMULATIVE CHIPS'}
            </p>
            <ValueUnitControl value={mode} onValueChange={setMode} />
          </div>
          <PlayerChart groupId={groupId} data={data} mode={mode} />
        </div>
      )}
    </>
  )
}
