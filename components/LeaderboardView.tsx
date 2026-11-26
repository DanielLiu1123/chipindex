'use client'

import { Button } from '@/components/ui/button'
import ResponsiveActions from '@/components/ResponsiveActions'
import actionStyles from '@/components/ResponsiveActions.module.css'
import LeaderboardTable from '@/components/LeaderboardTable'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { SegmentedControl } from '@/components/ui/segmented-control'
import ValueUnitControl from '@/components/ValueUnitControl'
import { Table2, ChartNoAxesCombined, Plus } from 'lucide-react'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { filterLowActivityPlayers } from '@/lib/stats'
import dynamic from 'next/dynamic'
import {
  leaderboardStatsForRange,
  buildChartData,
  defaultLeaderboardSort,
} from '@/lib/leaderboard'
import LeaderboardDateFilter from '@/components/LeaderboardDateFilter'
import { useSearchParams } from 'next/navigation'
import { readLeaderboardFilters, updateLeaderboardFilterQuery, type LeaderboardFilters } from '@/lib/leaderboard-filter-query'
import type { LeaderboardSessionRow, Player } from '@/lib/domain-types'
import { useBrowserReady } from '@/lib/use-browser-ready'
import { LeaderboardSkeleton } from '@/components/PageSkeleton'

const LeaderboardChart = dynamic(() => import('@/components/LeaderboardChart'), {
  loading: () => <div className="h-[360px]" role="status" aria-label="Loading chart" />,
})

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
  const [sort, setSort] = useState(defaultLeaderboardSort)
  const { filter, hideLowActivity } = filters

  function updateFilters(patch: Partial<LeaderboardFilters>) {
    const url = new URL(window.location.href)
    url.search = updateLeaderboardFilterQuery(url.search, patch).toString()
    window.history.replaceState(null, '', url)
  }
  const range = filter.period === 'all' ? null : filter.range
  const start = range?.start
  const end = range?.end
  const ranged = useMemo(
    () => leaderboardStatsForRange(players, sessions, start && end ? { start, end } : null),
    [players, sessions, start, end],
  )
  const stats = useMemo(
    () => hideLowActivity ? filterLowActivityPlayers(ranged.stats).visibleStats : ranged.stats,
    [ranged.stats, hideLowActivity],
  )
  const emptyRange = range !== null && ranged.sessions.length === 0

  const chartData = useMemo(
    () => view === 'chart' && ranged.sessions.length >= 2 ? buildChartData(ranged.sessions, stats, chartMode) : null,
    [view, ranged.sessions, stats, chartMode],
  )

  return (
    <>
      <ResponsiveActions className="mb-3">
        <SegmentedControl
          className={actionStyles.segmented}
          value={view}
          onValueChange={setView}
          label="Leaderboard view"
          options={[
            { value: 'table', label: 'Table', icon: <Table2 aria-hidden="true" /> },
            { value: 'chart', label: 'Chart', icon: <ChartNoAxesCombined aria-hidden="true" /> },
          ]}
        />
        <Button asChild className={actionStyles.action}>
          <Link href={`/groups/${groupId}/sessions/new`}><Plus aria-hidden="true" className="size-3.5" /><span>NEW SESSION</span></Link>
        </Button>
      </ResponsiveActions>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <LeaderboardDateFilter filter={filter} onChange={filter => updateFilters({ filter })} />
        <Label className="ml-auto min-h-9 gap-1.5 text-xs">
          <Switch
            checked={hideLowActivity}
            onCheckedChange={hideLowActivity => updateFilters({ hideLowActivity })}
            size="compact"
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
      {!emptyRange && view === 'table' && (
        <LeaderboardTable groupId={groupId} stats={stats} sort={sort} onSort={setSort} />
      )}
      {!emptyRange && view === 'chart' && (
        <div className="surface">
          <div className="flex justify-end px-2 mb-4">
            <ValueUnitControl value={chartMode} onValueChange={setChartMode} />
          </div>
          {chartData === null ? (
            <p className="text-muted-foreground text-xs tracking-normal px-2">
              NEED AT LEAST 2 SESSIONS TO SHOW CHART.
            </p>
          ) : (
            <LeaderboardChart
              key={`${start ?? ''}:${end ?? ''}:${hideLowActivity}`}
              data={chartData}
              players={stats.map(stat => stat.player)}
              mode={chartMode}
            />
          )}
        </div>
      )}
    </>
  )
}
