'use client'

import { useEffect, useRef, useState } from 'react'
import type { buildLeaderboard } from './leaderboard'
import { allocateLeaderboardColumns, leaderboardColumns, type LeaderboardColumn } from './leaderboard-layout'

type Layout = ReturnType<typeof allocateLeaderboardColumns>
type Measurements = Partial<Record<LeaderboardColumn, number>>

function measureColumns(table: HTMLTableElement, context: CanvasRenderingContext2D): Measurements {
  const measured: Measurements = {}
  for (const key of leaderboardColumns) {
    let maximum = 0
    for (const cell of table.querySelectorAll<HTMLElement>(`[data-column="${key}"]`)) {
      const text = cell.querySelector('button, a') ?? cell
      context.font = getComputedStyle(text).font
      const content = text.textContent ?? ''
      // Reserve the arrow's space even when this column is not sorted.
      const value = cell.tagName === 'TH' && cell.querySelector('button')
        ? content.replace(/[↑↓]/g, '').trim() + ' ↓'
        : content
      const style = getComputedStyle(cell)
      const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0)
      maximum = Math.max(maximum, context.measureText(value).width + padding)
    }
    measured[key] = Math.ceil(maximum)
  }
  return measured
}

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
      measured ??= measureColumns(table, context)
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
