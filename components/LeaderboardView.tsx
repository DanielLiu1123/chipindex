'use client'

import {
  TableHead,
  Table,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { SegmentedControl } from '@/components/ui/segmented-control'
import ValueUnitControl from '@/components/ValueUnitControl'
import { Table2, ChartNoAxesCombined } from 'lucide-react'
import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import ChipValue from '@/components/ChipValue'
import LeaderboardChart from '@/components/LeaderboardChart'
import {
  buildLeaderboard,
  type LeaderboardSortKey as SortKey,
} from '@/lib/leaderboard'
import LeaderboardDateFilter from '@/components/LeaderboardDateFilter'
import { useSearchParams } from 'next/navigation'
import { readLeaderboardFilters, updateLeaderboardFilterQuery, type LeaderboardFilters } from '@/lib/leaderboard-filter-query'
import type { LeaderboardSessionRow, Player } from '@/lib/domain-types'
import { useBrowserReady } from '@/lib/use-browser-ready'
import { allocateLeaderboardColumns, leaderboardColumns, type LeaderboardColumn } from '@/lib/leaderboard-layout'
import { LeaderboardSkeleton } from '@/components/PageSkeleton'

function SortHeader({
  label,
  sortKey: key,
  currentKey,
  sortDir,
  onSort,
  align = 'right',
  className = '',
}: {
  label: string
  className?: string
  align?: 'right' | 'center'
  sortKey: SortKey
  currentKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
}) {
  const active = currentKey === key
  return (
    <TableHead data-column={key} aria-sort={active ? (sortDir === 'desc' ? 'descending' : 'ascending') : undefined} className={`${className} px-2 py-3 font-normal ${align === 'center' ? 'text-center' : 'text-right'}`}>
      <Button variant="ghost" className="px-0 text-xs" type="button" onClick={() => onSort(key)}>
        {label}
        {active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
      </Button>
    </TableHead>
  )
}

interface Props {
  groupId: string
  players: Player[]
  sessions: LeaderboardSessionRow[]
}

export default function LeaderboardView(props: Props) {
  const searchParams = useSearchParams()
  const ready = useBrowserReady()
  const filters = useMemo(() => {
    const period = searchParams.get('period')
    // Relative dates must never be resolved using the server's local timezone.
    if (!ready && (period === 'month' || period === 'last-month' || period === 'year')) return null
    return readLeaderboardFilters(searchParams)
  }, [searchParams, ready])

  return filters
    ? <LeaderboardContent {...props} filters={filters} />
    : <LeaderboardSkeleton />
}

function LeaderboardContent({ groupId, players, sessions, filters }: Props & { filters: LeaderboardFilters }) {
  const tableContainer = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<ReturnType<typeof allocateLeaderboardColumns> | null>(null)
  const [view, setView] = useState<'table' | 'chart'>('table')
  const [chartMode, setChartMode] = useState<'chips' | 'cny'>('cny')
  const [sortKey, setSortKey] = useState<SortKey>('total_yuan')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const { filter, hideLowActivity } = filters

  function updateFilters(patch: Partial<LeaderboardFilters>) {
    const url = new URL(window.location.href)
    url.search = updateLeaderboardFilterQuery(url.search, patch).toString()
    window.history.replaceState(null, '', url)
  }
  const range = filter.period === 'all' ? null : filter.range
  const {
    sessionCount,
    playerCount,
    emptyRange,
    sortedStats,
    chartPlayers,
    chartData,
  } = useMemo(
    () =>
      buildLeaderboard(players, sessions, {
        range,
        hideLowActivity,
        chartMode,
        sortKey,
        sortDir,
      }),
    [players, sessions, range, hideLowActivity, chartMode, sortKey, sortDir],
  )
  const showResults = !emptyRange

  useEffect(() => {
    const container = tableContainer.current
    if (!container) return
    let active = true
    function measure() {
      if (!active || !container) return
      const width = container.clientWidth - 2 // Table border.
      if (width <= 0) return
      const context = document.createElement('canvas').getContext('2d')
      if (!context) return
      const table = container.querySelector('table')!
      const measured: Partial<Record<LeaderboardColumn, number>> = {}
      for (const key of leaderboardColumns) {
        let maximum = 0
        for (const cell of table.querySelectorAll<HTMLElement>(`[data-column="${key}"]`)) {
          const text = cell.querySelector('button, a') ?? cell
          const style = getComputedStyle(text)
          context.font = style.font
          // Reserve space for the sorting arrow regardless of current sort.
          const value = cell.tagName === 'TH' ? text.textContent!.replace(/[↑↓]/g, '').trim() + ' ↓' : text.textContent ?? ''
          maximum = Math.max(maximum, context.measureText(value).width + 16)
        }
        measured[key] = Math.ceil(maximum)
      }
      const next = allocateLeaderboardColumns(width, measured)
      setLayout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    measure()
    void document.fonts?.ready.then(measure)
    document.fonts?.addEventListener('loadingdone', measure)
    return () => {
      active = false
      observer.disconnect()
      document.fonts?.removeEventListener('loadingdone', measure)
    }
  }, [view, showResults, sortedStats])

  useEffect(() => {
    if (layout && !layout.visible.includes(sortKey)) {
      setSortKey('total_yuan')
      setSortDir('desc')
    }
  }, [layout, sortKey])

  function columnClass(key: LeaderboardColumn) {
    return layout && !layout.visible.includes(key) ? 'hidden' : ''
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <SegmentedControl
          value={view}
          onValueChange={setView}
          label="Leaderboard view"
          options={[
            { value: 'table', label: 'Table', icon: <Table2 aria-hidden="true" /> },
            { value: 'chart', label: 'Chart', icon: <ChartNoAxesCombined aria-hidden="true" /> },
          ]}
        />
        <Button asChild>
          <Link href={`/groups/${groupId}/sessions/new`}>+ NEW SESSION</Link>
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <LeaderboardDateFilter filter={filter} onChange={filter => updateFilters({ filter })} />
        <Label className="ml-auto flex min-h-11 items-center gap-2 text-sm">
          <Switch
            checked={hideLowActivity}
            onCheckedChange={hideLowActivity => updateFilters({ hideLowActivity })}
            aria-label="Active only"
          />
          Active only
        </Label>
      </div>

      {emptyRange && (
        <p className="py-12 text-center text-xs text-muted-foreground tracking-normal">
          NO SESSIONS
        </p>
      )}
      {showResults && view === 'table' && (
        <div ref={tableContainer}>
          <Table className="w-full table-fixed text-sm tabular-nums">
            <colgroup>
              <col style={{ width: 28 }} />
              {(layout?.visible ?? leaderboardColumns).map(key => (
                <col key={key} style={{ width: layout?.widths[key] }} />
              ))}
            </colgroup>
            <TableHeader>
              <TableRow className="border-b border-border text-muted-foreground text-xs tracking-normal">
                <TableHead className="text-center px-0.5 py-3 font-normal">
                  #
                </TableHead>
                <TableHead data-column="player" className="text-left px-2 py-3 font-normal">
                  PLAYER
                </TableHead>
                <SortHeader
                  currentKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  label="CNY"
                  sortKey="total_yuan"
                />
                <SortHeader
                  currentKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  label="CHIPS"
                  className={columnClass('total_chips')}
                  sortKey="total_chips"
                />
                <SortHeader
                  currentKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  label="SESSIONS"
                  className={columnClass('sessions_played')}
                  align="center"
                  sortKey="sessions_played"
                />
                <SortHeader
                  currentKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  label="WIN%"
                  className={columnClass('win_rate')}
                  align="center"
                  sortKey="win_rate"
                />
                <SortHeader
                  currentKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  label="POG"
                  className={columnClass('pog_count')}
                  align="center"
                  sortKey="pog_count"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {playerCount === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={1 + (layout?.visible.length ?? leaderboardColumns.length)}
                    className="py-12 text-center text-xs text-muted-foreground tracking-normal"
                  >
                    NO PLAYERS YET
                  </TableCell>
                </TableRow>
              )}
              {sortedStats.map((s, i) => (
                <TableRow
                  key={s.player.id}
                  className="border-b border-border hover:bg-muted transition-colors"
                >
                  <TableCell className="px-0.5 py-4 text-center text-muted-foreground text-xs">
                    <Link
                      href={`/groups/${groupId}/players/${s.player.id}`}
                      className="block"
                    >
                      {i + 1}
                    </Link>
                  </TableCell>
                  <TableCell data-column="player" className="px-2 py-4 whitespace-normal [overflow-wrap:anywhere]">
                    <Link
                      href={`/groups/${groupId}/players/${s.player.id}`}
                      className="block"
                    >
                      {s.player.name}
                    </Link>
                  </TableCell>
                  <TableCell data-column="total_yuan" className="px-2 py-4 text-right">
                    <Link
                      href={`/groups/${groupId}/players/${s.player.id}`}
                      className="block"
                    >
                      <ChipValue chips={s.total_yuan} prefix="¥" />
                    </Link>
                  </TableCell>
                  <TableCell data-column="total_chips" className={`${columnClass('total_chips')} px-2 py-4 text-right`}>
                    <Link
                      href={`/groups/${groupId}/players/${s.player.id}`}
                      className="block"
                    >
                      <ChipValue chips={s.total_chips} />
                    </Link>
                  </TableCell>
                  <TableCell data-column="sessions_played" className={`${columnClass('sessions_played')} px-2 py-4 text-center text-muted-foreground`}>
                    <Link
                      href={`/groups/${groupId}/players/${s.player.id}`}
                      className="block"
                    >
                      {s.sessions_played}
                    </Link>
                  </TableCell>
                  <TableCell data-column="win_rate" className={`${columnClass('win_rate')} px-2 py-4 text-center text-muted-foreground`}>
                    <Link
                      href={`/groups/${groupId}/players/${s.player.id}`}
                      className="block"
                    >
                      {(s.win_rate * 100).toFixed(0)}%
                    </Link>
                  </TableCell>
                  <TableCell data-column="pog_count" className={`${columnClass('pog_count')} px-2 py-4 text-center text-muted-foreground`}>
                    <Link
                      href={`/groups/${groupId}/players/${s.player.id}`}
                      className="block"
                    >
                      {s.pog_count}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {showResults && view === 'chart' && (
        <div className="surface">
          <div className="flex justify-end px-2 mb-4">
            <ValueUnitControl value={chartMode} onValueChange={setChartMode} />
          </div>
          {sessionCount < 2 ? (
            <p className="text-muted-foreground text-xs tracking-normal px-2">
              NEED AT LEAST 2 SESSIONS TO SHOW CHART.
            </p>
          ) : (
            <LeaderboardChart
              key={`${range?.start ?? ''}:${range?.end ?? ''}:${hideLowActivity}`}
              data={chartData}
              players={chartPlayers}
              mode={chartMode}
            />
          )}
        </div>
      )}
    </>
  )
}
