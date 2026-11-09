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
import { useState, useMemo, useEffect } from 'react'
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
import { LEADERBOARD_RANK_WIDTH, leaderboardColumns, type LeaderboardColumn } from '@/lib/leaderboard-layout'
import { useLeaderboardLayout } from '@/lib/use-leaderboard-layout'
import { LeaderboardSkeleton } from '@/components/PageSkeleton'

function SortHeader({
  label,
  sortKey: key,
  currentKey,
  sortDir,
  onSort,
  className = '',
}: {
  label: string
  className?: string
  sortKey: SortKey
  currentKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
}) {
  const active = currentKey === key
  return (
    <TableHead data-column={key} aria-sort={active ? (sortDir === 'desc' ? 'descending' : 'ascending') : undefined} className={`${className} px-2 py-3 font-normal text-right`}>
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

  const { containerRef, layout } = useLeaderboardLayout(sortedStats, showResults && view === 'table')

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
        <div ref={containerRef}>
          <Table className="w-full table-fixed text-sm tabular-nums">
            <colgroup>
              <col style={{ width: LEADERBOARD_RANK_WIDTH }} />
              {(layout?.visible ?? leaderboardColumns).map(key => (
                <col key={key} style={{ width: layout?.widths[key] }} />
              ))}
            </colgroup>
            <TableHeader>
              <TableRow className="border-b border-border text-muted-foreground text-xs tracking-normal">
                <TableHead className="text-right px-0.5 py-3 font-normal">
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
                  sortKey="sessions_played"
                />
                <SortHeader
                  currentKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  label="WIN%"
                  className={columnClass('win_rate')}
                  sortKey="win_rate"
                />
                <SortHeader
                  currentKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                  label="POG"
                  className={columnClass('pog_count')}
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
                  <TableCell className="px-0.5 py-4 text-right text-muted-foreground text-xs">
                    <Link
                      href={`/groups/${groupId}/players/${s.player.id}`}
                      className="block"
                    >
                      {i + 1}
                    </Link>
                  </TableCell>
                  <TableCell data-column="player" className="px-2 py-4 text-left whitespace-normal [overflow-wrap:anywhere]">
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
                  <TableCell data-column="sessions_played" className={`${columnClass('sessions_played')} px-2 py-4 text-right text-muted-foreground`}>
                    <Link
                      href={`/groups/${groupId}/players/${s.player.id}`}
                      className="block"
                    >
                      {s.sessions_played}
                    </Link>
                  </TableCell>
                  <TableCell data-column="win_rate" className={`${columnClass('win_rate')} px-2 py-4 text-right text-muted-foreground`}>
                    <Link
                      href={`/groups/${groupId}/players/${s.player.id}`}
                      className="block"
                    >
                      {(s.win_rate * 100).toFixed(0)}%
                    </Link>
                  </TableCell>
                  <TableCell data-column="pog_count" className={`${columnClass('pog_count')} px-2 py-4 text-right text-muted-foreground`}>
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
