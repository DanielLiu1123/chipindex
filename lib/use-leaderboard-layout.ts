'use client'

import { useEffect, useRef, useState } from 'react'
import { measureTableColumns } from './measure-table-columns'
import type { buildLeaderboard } from './leaderboard'
import { allocateLeaderboardColumns, leaderboardColumns, type LeaderboardColumn } from './leaderboard-layout'

type Layout = ReturnType<typeof allocateLeaderboardColumns>
type Measurements = Partial<Record<LeaderboardColumn, number>>

const measuredColumns = leaderboardColumns.map(key => ({ key }))

export function useLeaderboardLayout(rows: ReturnType<typeof buildLeaderboard>['sortedStats'], enabled: boolean) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<Layout | null>(null)

  useEffect(() => {
    const container = containerRef.current
    const table = container?.querySelector('table')
    if (!enabled || !container || !table) return
    let active = true
    let context: CanvasRenderingContext2D | null = null
    let measured: Measurements | null = null

    function updateLayout() {
      if (!active || !container || !table) return
      const frame = table.parentElement!
      const style = getComputedStyle(frame)
      const border = (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0)
      const width = container.clientWidth - border
      if (width <= 0) return
      context ??= document.createElement('canvas').getContext('2d')
      if (!context) return
      measured ??= measureTableColumns(table, context, measuredColumns, true)
      const next = allocateLeaderboardColumns(width, measured)
      setLayout(previous => previous && leaderboardColumns.every(key => previous.widths[key] === next.widths[key]) ? previous : next)
    }

    function fontsChanged() {
      measured = null
      updateLayout()
    }
    const observer = new ResizeObserver(updateLayout)
    observer.observe(container)
    updateLayout()
    void document.fonts?.ready.then(fontsChanged)
    document.fonts?.addEventListener('loadingdone', fontsChanged)
    return () => {
      active = false
      observer.disconnect()
      document.fonts?.removeEventListener('loadingdone', fontsChanged)
    }
  }, [rows, enabled])

  return { containerRef, layout }
}
