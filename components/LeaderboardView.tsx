'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import ChipValue from '@/components/ChipValue'
import LeaderboardChart from '@/components/LeaderboardChart'
import { computeLeaderboardStats, filterLowActivityPlayers } from '@/lib/stats'
import { filterLeaderboardSessions, leaderboardRangeError, presetLeaderboardRange, type LeaderboardPeriod, type LeaderboardRange } from '@/lib/leaderboard-range'
import type { LeaderboardSessionRow, Player } from '@/lib/domain-types'

function buildChartData(sessions: LeaderboardSessionRow[], stats: ReturnType<typeof computeLeaderboardStats>, mode: 'chips' | 'cny'): { date: string; [player: string]: string | number }[] {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  const playerIds = stats.map(s => s.player.id)

  const cumulative = new Map<string, number>()
  playerIds.forEach(pid => cumulative.set(pid, 0))

  return sorted.map(session => {
    const row: { date: string; [k: string]: string | number } = { date: session.date }
    playerIds.forEach(pid => {
      const entry = session.session_entries.find(e => e.player_id === pid)
      if (entry) {
        const delta = mode === 'cny' ? entry.chips / session.exchange_rate : entry.chips
        cumulative.set(pid, (cumulative.get(pid) ?? 0) + delta)
      }
      row[pid] = mode === 'cny' ? Math.round((cumulative.get(pid) ?? 0) * 100) / 100 : (cumulative.get(pid) ?? 0)
    })
    return row
  })
}

type SortKey = 'total_yuan' | 'total_chips' | 'sessions_played' | 'win_rate' | 'pog_count'

function SortHeader({ label, sortKey: key, currentKey, sortDir, onSort }: { label: string; sortKey: SortKey; currentKey: SortKey; sortDir: 'asc' | 'desc'; onSort: (key: SortKey) => void }) {
  const active = currentKey === key
  return (
    <th className="text-right py-3 font-normal">
      <button onClick={() => onSort(key)}
        className={`tracking-widest transition-colors ${active ? 'text-white' : 'text-muted hover:text-white'}`}>
        {label}{active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  )
}

export default function LeaderboardView({ groupId, players, sessions }: { groupId: string; players: Player[]; sessions: LeaderboardSessionRow[] }) {
  const [view, setView] = useState<'table' | 'chart'>('table')
  const [chartMode, setChartMode] = useState<'chips' | 'cny'>('cny')
  const [sortKey, setSortKey] = useState<SortKey>('total_yuan')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [hideLowActivity, setHideLowActivity] = useState(true)
  const [period, setPeriod] = useState<LeaderboardPeriod>('all')
  const [range, setRange] = useState<LeaderboardRange>({ start: '', end: '' })
  const rangeError = period === 'custom' ? leaderboardRangeError(range) : null
  const filteredSessions = useMemo(
    () => rangeError ? [] : filterLeaderboardSessions(sessions, range),
    [sessions, range, rangeError],
  )
  const stats = useMemo(() => {
    const computed = computeLeaderboardStats(players, filteredSessions)
    return period === 'all' ? computed : computed.filter(stat => stat.sessions_played > 0)
  }, [players, filteredSessions, period])

  function changePeriod(next: LeaderboardPeriod) {
    setPeriod(next)
    if (next !== 'custom') setRange(presetLeaderboardRange(next))
    else if (!range.start || !range.end) setRange(presetLeaderboardRange('month'))
  }

  const activityFilter = useMemo(() => filterLowActivityPlayers(stats), [stats])
  const displayedStats = hideLowActivity ? activityFilter.visibleStats : stats
  const chartPlayers = displayedStats.map(stat => ({ id: stat.player.id, name: stat.player.name }))
  const chartData = useMemo(
    () => buildChartData(filteredSessions, displayedStats, chartMode),
    [filteredSessions, displayedStats, chartMode],
  )

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
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
        <div className="flex items-baseline gap-4">
          <div className="flex gap-3">
            <button onClick={() => setView('table')}
              className={`text-xs tracking-widest transition-colors ${view === 'table' ? 'text-white' : 'text-muted hover:text-white'}`}>
              TABLE
            </button>
            <span className="text-muted text-xs">/</span>
            <button onClick={() => setView('chart')}
              className={`text-xs tracking-widest transition-colors ${view === 'chart' ? 'text-white' : 'text-muted hover:text-white'}`}>
              CHART
            </button>
          </div>
        </div>
        <Link href={`/groups/${groupId}/sessions/new`} className="text-xs text-accent tracking-widest hover:underline">+ NEW SESSION</Link>
      </div>

      <div className="mb-6">
        <div role="group" aria-label="Leaderboard period" className="flex flex-wrap items-center gap-2">
          {([
            ['all', 'ALL'],
            ['month', 'THIS MONTH'],
            ['last-month', 'LAST MONTH'],
            ['year', 'THIS YEAR'],
            ['custom', 'CUSTOM'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={period === value} onClick={() => changePeriod(value)}
              className={`min-h-9 border px-3 py-2 text-[10px] tracking-widest transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-xs ${period === value ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border bg-surface text-[#aaaaaa] hover:border-muted hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="mt-4 flex items-center gap-3 max-w-sm">
            <input type="date" aria-label="Start date" value={range.start} max={range.end || undefined}
              aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? 'leaderboard-range-error' : undefined}
              onChange={event => setRange(current => ({ ...current, start: event.target.value }))}
              className="w-full min-w-0 bg-surface border border-border text-white text-xs px-3 py-2 outline-none focus:border-white transition-colors" />
            <span aria-hidden="true" className="text-xs text-muted">–</span>
            <input type="date" aria-label="End date" value={range.end} min={range.start || undefined}
              aria-invalid={Boolean(rangeError)} aria-describedby={rangeError ? 'leaderboard-range-error' : undefined}
              onChange={event => setRange(current => ({ ...current, end: event.target.value }))}
              className="w-full min-w-0 bg-surface border border-border text-white text-xs px-3 py-2 outline-none focus:border-white transition-colors" />
          </div>
        )}
      </div>
      {rangeError && <p id="leaderboard-range-error" role="alert" className="text-danger text-xs mb-4">{rangeError}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2 min-h-8 mb-3 text-[10px] tracking-widest text-muted">
        <button
          type="button"
          aria-pressed={hideLowActivity}
          onClick={() => setHideLowActivity(hidden => !hidden)}
          className="flex items-center gap-2 text-[#aaaaaa] transition-colors hover:text-white"
        >
          <span
            aria-hidden="true"
            className={`relative inline-flex h-4 w-7 shrink-0 border transition-colors ${hideLowActivity ? 'border-accent' : 'border-muted'}`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-2.5 w-2.5 transition-all ${hideLowActivity ? 'translate-x-3 bg-accent' : 'bg-muted'}`}
            />
          </span>
          HIDE LOW-ACTIVITY PLAYERS
        </button>
        <span>
          {hideLowActivity && activityFilter.hiddenCount > 0
            ? `${activityFilter.hiddenCount} HIDDEN · FEWER THAN ${activityFilter.threshold} SESSIONS`
            : `SHOWING ALL ${stats.length} PLAYERS`}
        </span>
      </div>

      {rangeError ? null : filteredSessions.length === 0 && period !== 'all' ? (
        <p className="py-12 text-center text-xs text-muted tracking-widest">NO SESSIONS</p>
      ) : view === 'table' ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted text-xs tracking-widest">
              <th className="text-left py-3 font-normal w-8">#</th>
              <th className="text-left py-3 font-normal">PLAYER</th>
              <SortHeader currentKey={sortKey} sortDir={sortDir} onSort={toggleSort} label="CNY" sortKey="total_yuan" />
              <SortHeader currentKey={sortKey} sortDir={sortDir} onSort={toggleSort} label="CHIPS" sortKey="total_chips" />
              <SortHeader currentKey={sortKey} sortDir={sortDir} onSort={toggleSort} label="SESSIONS" sortKey="sessions_played" />
              <SortHeader currentKey={sortKey} sortDir={sortDir} onSort={toggleSort} label="WIN%" sortKey="win_rate" />
              <SortHeader currentKey={sortKey} sortDir={sortDir} onSort={toggleSort} label="POG" sortKey="pog_count" />
            </tr>
          </thead>
          <tbody>
            {stats.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-xs text-muted tracking-widest">NO PLAYERS YET</td>
              </tr>
            )}
            {sortedStats.map((s, i) => (
              <tr key={s.player.id} className="border-b border-border hover:bg-surface transition-colors">
                <td className="py-4 text-muted text-xs">
                  <Link href={`/groups/${groupId}/players/${s.player.id}`} className="block">{i + 1}</Link>
                </td>
                <td className="py-4">
                  <Link href={`/groups/${groupId}/players/${s.player.id}`} className="block">{s.player.name}</Link>
                </td>
                <td className="py-4 text-right">
                  <Link href={`/groups/${groupId}/players/${s.player.id}`} className="block"><ChipValue chips={s.total_yuan} prefix="¥" /></Link>
                </td>
                <td className="py-4 text-right">
                  <Link href={`/groups/${groupId}/players/${s.player.id}`} className="block"><ChipValue chips={s.total_chips} /></Link>
                </td>
                <td className="py-4 text-right text-muted">
                  <Link href={`/groups/${groupId}/players/${s.player.id}`} className="block">{s.sessions_played}</Link>
                </td>
                <td className="py-4 text-right text-muted">
                  <Link href={`/groups/${groupId}/players/${s.player.id}`} className="block">{(s.win_rate * 100).toFixed(0)}%</Link>
                </td>
                <td className="py-4 text-right text-muted">
                  <Link href={`/groups/${groupId}/players/${s.player.id}`} className="block">{s.pog_count}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="-mx-2">
          <div className="flex justify-end px-2 mb-4">
            <div className="flex gap-3">
              <button onClick={() => setChartMode('cny')}
                className={`text-xs tracking-widest transition-colors ${chartMode === 'cny' ? 'text-white' : 'text-muted hover:text-white'}`}>
                CNY
              </button>
              <span className="text-muted text-xs">/</span>
              <button onClick={() => setChartMode('chips')}
                className={`text-xs tracking-widest transition-colors ${chartMode === 'chips' ? 'text-white' : 'text-muted hover:text-white'}`}>
                CHIPS
              </button>
            </div>
          </div>
          {filteredSessions.length < 2 ? (
            <p className="text-muted text-xs tracking-widest px-2">NEED AT LEAST 2 SESSIONS TO SHOW CHART.</p>
          ) : (
            <LeaderboardChart
              key={`${period}:${range.start}:${range.end}:${hideLowActivity}`}
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
