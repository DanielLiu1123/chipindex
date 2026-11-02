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
import { Table2, ChartNoAxesCombined } from 'lucide-react'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import ChipValue from '@/components/ChipValue'
import LeaderboardChart from '@/components/LeaderboardChart'
import {
  buildLeaderboard,
  type LeaderboardSortKey as SortKey,
} from '@/lib/leaderboard'
import LeaderboardDateFilter from '@/components/LeaderboardDateFilter'
import type { LeaderboardFilter } from '@/lib/leaderboard-range'
import type { LeaderboardSessionRow, Player } from '@/lib/domain-types'

function SortHeader({
  label,
  sortKey: key,
  currentKey,
  sortDir,
  onSort,
  align = 'right',
}: {
  label: string
  align?: 'right' | 'center'
  sortKey: SortKey
  currentKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
}) {
  const active = currentKey === key
  return (
    <TableHead className={`py-3 font-normal ${align === 'center' ? 'text-center' : 'text-right'}`}>
      <Button variant="ghost" type="button" onClick={() => onSort(key)}>
        {label}
        {active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
      </Button>
    </TableHead>
  )
}

export default function LeaderboardView({
  groupId,
  players,
  sessions,
}: {
  groupId: string
  players: Player[]
  sessions: LeaderboardSessionRow[]
}) {
  const [view, setView] = useState<'table' | 'chart'>('table')
  const [chartMode, setChartMode] = useState<'chips' | 'cny'>('cny')
  const [sortKey, setSortKey] = useState<SortKey>('total_yuan')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [hideLowActivity, setHideLowActivity] = useState(true)
  const [filter, setFilter] = useState<LeaderboardFilter>({ period: 'all' })
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
        <LeaderboardDateFilter filter={filter} onChange={setFilter} />
        <Label className="ml-auto flex min-h-11 items-center gap-2 text-sm">
          <Switch
            checked={hideLowActivity}
            onCheckedChange={setHideLowActivity}
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
        <Table className="w-full text-sm tabular-nums">
          <TableHeader>
            <TableRow className="border-b border-border text-muted-foreground text-xs tracking-normal">
              <TableHead className="text-left py-3 font-normal w-8">
                #
              </TableHead>
              <TableHead className="text-left py-3 font-normal">
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
                sortKey="total_chips"
              />
              <SortHeader
                currentKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                label="SESSIONS"
                align="center"
                sortKey="sessions_played"
              />
              <SortHeader
                currentKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                label="WIN%"
                align="center"
                sortKey="win_rate"
              />
              <SortHeader
                currentKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                label="POG"
                align="center"
                sortKey="pog_count"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {playerCount === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
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
                <TableCell className="py-4 text-muted-foreground text-xs">
                  <Link
                    href={`/groups/${groupId}/players/${s.player.id}`}
                    className="block"
                  >
                    {i + 1}
                  </Link>
                </TableCell>
                <TableCell className="py-4">
                  <Link
                    href={`/groups/${groupId}/players/${s.player.id}`}
                    className="block"
                  >
                    {s.player.name}
                  </Link>
                </TableCell>
                <TableCell className="py-4 text-right">
                  <Link
                    href={`/groups/${groupId}/players/${s.player.id}`}
                    className="block"
                  >
                    <ChipValue chips={s.total_yuan} prefix="¥" />
                  </Link>
                </TableCell>
                <TableCell className="py-4 text-right">
                  <Link
                    href={`/groups/${groupId}/players/${s.player.id}`}
                    className="block"
                  >
                    <ChipValue chips={s.total_chips} />
                  </Link>
                </TableCell>
                <TableCell className="py-4 text-center text-muted-foreground">
                  <Link
                    href={`/groups/${groupId}/players/${s.player.id}`}
                    className="block"
                  >
                    {s.sessions_played}
                  </Link>
                </TableCell>
                <TableCell className="py-4 text-center text-muted-foreground">
                  <Link
                    href={`/groups/${groupId}/players/${s.player.id}`}
                    className="block"
                  >
                    {(s.win_rate * 100).toFixed(0)}%
                  </Link>
                </TableCell>
                <TableCell className="py-4 text-center text-muted-foreground">
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
      )}
      {showResults && view === 'chart' && (
        <div className="surface">
          <div className="flex justify-end px-2 mb-4">
            <SegmentedControl
              value={chartMode}
              onValueChange={setChartMode}
              label="Value unit"
              compact
              options={[{ value: 'cny', label: 'CNY' }, { value: 'chips', label: 'CHIPS' }]}
            />
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
