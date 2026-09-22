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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import ChipValue from '@/components/ChipValue'
import LeaderboardChart from '@/components/LeaderboardChart'
import {
  computeLeaderboardStats,
  filterLowActivityPlayers,
  type PlayerStats,
} from '@/lib/stats'
import LeaderboardDateFilter from '@/components/LeaderboardDateFilter'
import {
  filterLeaderboardSessions,
  type LeaderboardFilter,
} from '@/lib/leaderboard-range'
import type { LeaderboardSessionRow, Player } from '@/lib/domain-types'

function buildChartData(
  sessions: LeaderboardSessionRow[],
  stats: PlayerStats[],
  mode: 'chips' | 'cny',
): { date: string; [player: string]: string | number }[] {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  const playerIds = stats.map((s) => s.player.id)

  const cumulative = new Map<string, number>()
  playerIds.forEach((pid) => cumulative.set(pid, 0))

  return sorted.map((session) => {
    const row: { date: string; [k: string]: string | number } = {
      date: session.date,
    }
    playerIds.forEach((pid) => {
      const entry = session.session_entries.find((e) => e.player_id === pid)
      if (entry) {
        const delta =
          mode === 'cny' ? entry.chips / session.exchange_rate : entry.chips
        cumulative.set(pid, (cumulative.get(pid) ?? 0) + delta)
      }
      row[pid] =
        mode === 'cny'
          ? Math.round((cumulative.get(pid) ?? 0) * 100) / 100
          : (cumulative.get(pid) ?? 0)
    })
    return row
  })
}

type SortKey =
  'total_yuan' | 'total_chips' | 'sessions_played' | 'win_rate' | 'pog_count'

function SortHeader({
  label,
  sortKey: key,
  currentKey,
  sortDir,
  onSort,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
}) {
  const active = currentKey === key
  return (
    <TableHead className="text-right py-3 font-normal">
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
  const filteredSessions = useMemo(
    () => filterLeaderboardSessions(sessions, range),
    [sessions, range],
  )
  const stats = useMemo(() => {
    const computed = computeLeaderboardStats(players, filteredSessions)
    return range
      ? computed.filter((stat) => stat.sessions_played > 0)
      : computed
  }, [players, filteredSessions, range])
  const emptyRange = range !== null && filteredSessions.length === 0
  const showResults = !emptyRange

  const activityFilter = useMemo(() => filterLowActivityPlayers(stats), [stats])
  const displayedStats = hideLowActivity ? activityFilter.visibleStats : stats
  const chartPlayers = displayedStats.map((stat) => ({
    id: stat.player.id,
    name: stat.player.name,
  }))
  const chartData = useMemo(
    () => buildChartData(filteredSessions, displayedStats, chartMode),
    [filteredSessions, displayedStats, chartMode],
  )

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortedStats = useMemo(() => {
    const dir = sortDir === 'desc' ? -1 : 1
    return [...displayedStats].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey]
      if (diff !== 0) return dir * diff
      return a.player.id.localeCompare(b.player.id)
    })
  }, [displayedStats, sortKey, sortDir])

  return (
    <>
      <div className="flex items-baseline justify-between mb-3">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(value) => {
            if (value === 'table' || value === 'chart') setView(value)
          }}
          aria-label="Leaderboard view"
          variant="outline"
        >
          <ToggleGroupItem value="table">TABLE</ToggleGroupItem>
          <ToggleGroupItem value="chart">CHART</ToggleGroupItem>
        </ToggleGroup>
        <Button asChild>
          <Link href={`/groups/${groupId}/sessions/new`}>+ NEW SESSION</Link>
        </Button>
      </div>

      <LeaderboardDateFilter filter={filter} onChange={setFilter} />

      <div className="flex flex-wrap items-center justify-between gap-2 min-h-8 mb-3 text-[10px] tracking-normal text-muted-foreground">
        <Label className="flex items-center gap-2 text-sm">
          <Switch
            checked={hideLowActivity}
            onCheckedChange={setHideLowActivity}
            aria-label="HIDE LOW-ACTIVITY PLAYERS"
          />
          HIDE LOW-ACTIVITY PLAYERS
        </Label>
        <span>
          {hideLowActivity && activityFilter.hiddenCount > 0
            ? `${activityFilter.hiddenCount} HIDDEN · FEWER THAN ${activityFilter.threshold} SESSIONS`
            : `SHOWING ALL ${stats.length} PLAYERS`}
        </span>
      </div>

      {emptyRange && (
        <p className="py-12 text-center text-xs text-muted-foreground tracking-normal">
          NO SESSIONS
        </p>
      )}
      {showResults && view === 'table' && (
        <Table className="w-full text-sm">
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
                sortKey="sessions_played"
              />
              <SortHeader
                currentKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                label="WIN%"
                sortKey="win_rate"
              />
              <SortHeader
                currentKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                label="POG"
                sortKey="pog_count"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.length === 0 && (
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
                <TableCell className="py-4 text-right text-muted-foreground">
                  <Link
                    href={`/groups/${groupId}/players/${s.player.id}`}
                    className="block"
                  >
                    {s.sessions_played}
                  </Link>
                </TableCell>
                <TableCell className="py-4 text-right text-muted-foreground">
                  <Link
                    href={`/groups/${groupId}/players/${s.player.id}`}
                    className="block"
                  >
                    {(s.win_rate * 100).toFixed(0)}%
                  </Link>
                </TableCell>
                <TableCell className="py-4 text-right text-muted-foreground">
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
        <div className="-mx-2">
          <div className="flex justify-end px-2 mb-4">
            <ToggleGroup
              type="single"
              value={chartMode}
              onValueChange={(value) => {
                if (value === 'cny' || value === 'chips') setChartMode(value)
              }}
              aria-label="Value unit"
              variant="outline"
            >
              <ToggleGroupItem value="cny">CNY</ToggleGroupItem>
              <ToggleGroupItem value="chips">CHIPS</ToggleGroupItem>
            </ToggleGroup>
          </div>
          {filteredSessions.length < 2 ? (
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
