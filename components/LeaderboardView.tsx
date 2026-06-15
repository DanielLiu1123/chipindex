'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import ChipValue from '@/components/ChipValue'
import LeaderboardChart from '@/components/LeaderboardChart'
import type { PlayerStats } from '@/lib/stats'
import type { LeaderboardSessionRow } from '@/lib/queries'

function buildChartData(sessions: LeaderboardSessionRow[], stats: PlayerStats[], mode: 'chips' | 'cny'): { date: string; [player: string]: string | number }[] {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  const playerNames = stats.map(s => s.player.name)
  const playerIds = stats.map(s => s.player.id)

  const cumulative = new Map<string, number>()
  playerIds.forEach(pid => cumulative.set(pid, 0))

  return sorted.map(session => {
    const row: { date: string; [k: string]: string | number } = { date: session.date }
    playerIds.forEach((pid, i) => {
      const entry = session.session_entries.find(e => e.player_id === pid)
      if (entry) {
        const delta = mode === 'cny' ? entry.chips / session.exchange_rate : entry.chips
        cumulative.set(pid, (cumulative.get(pid) ?? 0) + delta)
      }
      row[playerNames[i]] = mode === 'cny' ? Math.round((cumulative.get(pid) ?? 0) * 100) / 100 : (cumulative.get(pid) ?? 0)
    })
    return row
  })
}

type SortKey = 'total_yuan' | 'total_chips' | 'sessions_played' | 'win_rate' | 'pog_count'

export default function LeaderboardView({ stats, sessions }: { stats: PlayerStats[]; sessions: LeaderboardSessionRow[] }) {
  const [view, setView] = useState<'table' | 'chart'>('table')
  const [chartMode, setChartMode] = useState<'chips' | 'cny'>('cny')
  const [sortKey, setSortKey] = useState<SortKey>('total_yuan')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const playerNames = stats.map(s => s.player.name)
  const chartData = useMemo(() => buildChartData(sessions, stats, chartMode), [sessions, stats, chartMode])

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
    return [...stats].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey]
      if (diff !== 0) return dir * diff
      return a.player.name.localeCompare(b.player.name)
    })
  }, [stats, sortKey, sortDir])

  function SortHeader({ label, sortKey: key }: { label: string; sortKey: SortKey }) {
    const active = sortKey === key
    return (
      <th className="text-right py-3 font-normal">
        <button onClick={() => toggleSort(key)}
          className={`tracking-widest transition-colors ${active ? 'text-white' : 'text-muted hover:text-white'}`}>
          {label}{active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
        </button>
      </th>
    )
  }

  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
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
        <Link href="/sessions/new" className="text-xs text-accent tracking-widest hover:underline">+ NEW SESSION</Link>
      </div>

      {view === 'table' ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted text-xs tracking-widest">
              <th className="text-left py-3 font-normal w-8">#</th>
              <th className="text-left py-3 font-normal">PLAYER</th>
              <SortHeader label="CNY" sortKey="total_yuan" />
              <SortHeader label="CHIPS" sortKey="total_chips" />
              <SortHeader label="SESSIONS" sortKey="sessions_played" />
              <SortHeader label="WIN%" sortKey="win_rate" />
              <SortHeader label="POG" sortKey="pog_count" />
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
                  <Link href={`/players/${s.player.id}`} className="block">{i + 1}</Link>
                </td>
                <td className="py-4">
                  <Link href={`/players/${s.player.id}`} className="block">{s.player.name}</Link>
                </td>
                <td className="py-4 text-right">
                  <Link href={`/players/${s.player.id}`} className="block"><ChipValue chips={s.total_yuan} prefix="¥" /></Link>
                </td>
                <td className="py-4 text-right">
                  <Link href={`/players/${s.player.id}`} className="block"><ChipValue chips={s.total_chips} /></Link>
                </td>
                <td className="py-4 text-right text-muted">
                  <Link href={`/players/${s.player.id}`} className="block">{s.sessions_played}</Link>
                </td>
                <td className="py-4 text-right text-muted">
                  <Link href={`/players/${s.player.id}`} className="block">{(s.win_rate * 100).toFixed(0)}%</Link>
                </td>
                <td className="py-4 text-right text-muted">
                  <Link href={`/players/${s.player.id}`} className="block">{s.pog_count}</Link>
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
          {sessions.length < 2 ? (
            <p className="text-muted text-xs tracking-widest px-2">NEED AT LEAST 2 SESSIONS TO SHOW CHART.</p>
          ) : (
            <LeaderboardChart data={chartData} players={playerNames} mode={chartMode} />
          )}
        </div>
      )}
    </>
  )
}
