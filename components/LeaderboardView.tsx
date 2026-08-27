'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import ChipValue from '@/components/ChipValue'
import LeaderboardChart from '@/components/LeaderboardChart'
import { filterLowActivityPlayers } from '@/lib/stats'
import type { PlayerStats } from '@/lib/stats'
import type { LeaderboardSessionRow } from '@/lib/queries'

function buildChartData(sessions: LeaderboardSessionRow[], stats: PlayerStats[], mode: 'chips' | 'cny'): { date: string; [player: string]: string | number }[] {
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

function SortHeader({
  label,
  active,
  direction,
  onToggle,
}: {
  label: string
  active: boolean
  direction: 'asc' | 'desc'
  onToggle: () => void
}) {
  return (
    <th className="py-3 text-right font-normal">
      <button onClick={onToggle}
        className={`tracking-widest transition-colors ${active ? 'text-white' : 'text-muted hover:text-white'}`}>
        {label}{active ? (direction === 'desc' ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  )
}

export default function LeaderboardView({ groupId, stats, sessions }: { groupId: string; stats: PlayerStats[]; sessions: LeaderboardSessionRow[] }) {
  const [view, setView] = useState<'table' | 'chart'>('table')
  const [chartMode, setChartMode] = useState<'chips' | 'cny'>('cny')
  const [sortKey, setSortKey] = useState<SortKey>('total_yuan')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [hideLowActivity, setHideLowActivity] = useState(true)
  const activityFilter = useMemo(() => filterLowActivityPlayers(stats), [stats])
  const displayedStats = hideLowActivity ? activityFilter.visibleStats : stats
  const chartPlayers = displayedStats.map(stat => ({ id: stat.player.id, name: stat.player.name }))
  const chartData = useMemo(
    () => buildChartData(sessions, displayedStats, chartMode),
    [sessions, displayedStats, chartMode],
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
      <div className={`flex flex-wrap items-center justify-between gap-2 ${activityFilter.hiddenCount > 0 ? 'mb-3' : 'mb-6'}`}>
        <div className="flex items-baseline gap-4">
          <div className="flex gap-3">
            <button onClick={() => setView('table')}
              className={`inline-flex min-h-11 items-center text-xs tracking-widest transition-colors sm:min-h-0 ${view === 'table' ? 'text-white' : 'text-muted hover:text-white'}`}>
              TABLE
            </button>
            <span className="text-muted text-xs">/</span>
            <button onClick={() => setView('chart')}
              className={`inline-flex min-h-11 items-center text-xs tracking-widest transition-colors sm:min-h-0 ${view === 'chart' ? 'text-white' : 'text-muted hover:text-white'}`}>
              CHART
            </button>
          </div>
        </div>
        <Link href={`/groups/${groupId}/sessions/new`}
          className="inline-flex min-h-11 items-center text-xs tracking-widest text-accent hover:underline sm:min-h-0">+ NEW SESSION</Link>
      </div>

      {activityFilter.hiddenCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 min-h-8 mb-3 text-[10px] tracking-widest text-muted">
          <button
            type="button"
            aria-pressed={hideLowActivity}
            onClick={() => setHideLowActivity(hidden => !hidden)}
            className="flex min-h-11 items-center gap-2 text-[#aaaaaa] transition-colors hover:text-white sm:min-h-0"
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
            {hideLowActivity
              ? `${activityFilter.hiddenCount} HIDDEN · FEWER THAN ${activityFilter.threshold} SESSIONS`
              : `SHOWING ALL ${stats.length} PLAYERS`}
          </span>
        </div>
      )}

      {view === 'table' ? (
        <>
          <div className="mb-2 flex items-center gap-2 sm:hidden">
            <label className="text-[10px] tracking-widest text-muted" htmlFor="mobile-leaderboard-sort">SORT</label>
            <select
              id="mobile-leaderboard-sort"
              aria-label="Mobile leaderboard sort"
              value={sortKey}
              onChange={event => setSortKey(event.target.value as SortKey)}
              className="min-h-11 min-w-0 flex-1 border border-border bg-surface px-3 text-white outline-none focus:border-white"
            >
              <option value="total_yuan">CNY</option>
              <option value="total_chips">CHIPS</option>
              <option value="sessions_played">SESSIONS</option>
              <option value="win_rate">WIN RATE</option>
              <option value="pog_count">POG</option>
            </select>
            <button
              type="button"
              aria-label={sortDir === 'desc' ? 'Sort descending' : 'Sort ascending'}
              onClick={() => setSortDir(direction => direction === 'desc' ? 'asc' : 'desc')}
              className="inline-flex min-h-11 min-w-11 items-center justify-center border border-border text-accent"
            >
              {sortDir === 'desc' ? '↓' : '↑'}
            </button>
          </div>

          <ol className="sm:hidden" aria-label="Leaderboard">
            {stats.length === 0 && (
              <li className="py-12 text-center text-xs tracking-widest text-muted">NO PLAYERS YET</li>
            )}
            {sortedStats.map((stat, index) => (
              <li key={stat.player.id} className="border-b border-border">
                <Link href={`/groups/${groupId}/players/${stat.player.id}`} className="block py-4 active:bg-surface">
                  <div className="mb-3 flex min-w-0 items-baseline gap-3">
                    <span className="w-5 shrink-0 text-xs text-muted">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-base text-white">{stat.player.name}</span>
                    <ChipValue chips={stat.total_yuan} prefix="¥" className="text-sm" />
                  </div>
                  <dl className="grid grid-cols-4 gap-2 pl-8">
                    <div>
                      <dt className="mb-1 text-[9px] tracking-widest text-muted">CHIPS</dt>
                      <dd className="text-xs"><ChipValue chips={stat.total_chips} /></dd>
                    </div>
                    <div className="text-right">
                      <dt className="mb-1 text-[9px] tracking-widest text-muted">SESSIONS</dt>
                      <dd className="text-xs text-muted">{stat.sessions_played}</dd>
                    </div>
                    <div className="text-right">
                      <dt className="mb-1 text-[9px] tracking-widest text-muted">WIN RATE</dt>
                      <dd className="text-xs text-muted">{(stat.win_rate * 100).toFixed(0)}%</dd>
                    </div>
                    <div className="text-right">
                      <dt className="mb-1 text-[9px] tracking-widest text-muted">POG</dt>
                      <dd className="text-xs text-muted">{stat.pog_count}</dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
          </ol>

          <table className="hidden w-full text-sm sm:table">
          <thead>
            <tr className="border-b border-border text-muted text-xs tracking-widest">
              <th className="text-left py-3 font-normal w-8">#</th>
              <th className="text-left py-3 font-normal">PLAYER</th>
              <SortHeader label="CNY" active={sortKey === 'total_yuan'} direction={sortDir} onToggle={() => toggleSort('total_yuan')} />
              <SortHeader label="CHIPS" active={sortKey === 'total_chips'} direction={sortDir} onToggle={() => toggleSort('total_chips')} />
              <SortHeader label="SESSIONS" active={sortKey === 'sessions_played'} direction={sortDir} onToggle={() => toggleSort('sessions_played')} />
              <SortHeader label="WIN%" active={sortKey === 'win_rate'} direction={sortDir} onToggle={() => toggleSort('win_rate')} />
              <SortHeader label="POG" active={sortKey === 'pog_count'} direction={sortDir} onToggle={() => toggleSort('pog_count')} />
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
        </>
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
          {sessions.length < 2 ? (
            <p className="text-muted text-xs tracking-widest px-2">NEED AT LEAST 2 SESSIONS TO SHOW CHART.</p>
          ) : (
            <LeaderboardChart
              key={hideLowActivity ? 'low-activity-hidden' : 'all-players'}
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
