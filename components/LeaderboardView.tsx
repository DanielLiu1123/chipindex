'use client'

import { useState } from 'react'
import Link from 'next/link'
import ChipValue from '@/components/ChipValue'
import LeaderboardChart from '@/components/LeaderboardChart'
import type { PlayerStats } from '@/types'

interface Session {
  id: string
  date: string
  session_entries: { player_id: string; chips: number }[]
}

function buildChartData(sessions: Session[], stats: PlayerStats[]) {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
  const playerNames = stats.map(s => s.player.name)
  const playerIds = stats.map(s => s.player.id)

  return sorted.map(session => {
    const row: { date: string; [k: string]: string | number } = { date: session.date }
    playerIds.forEach((pid, i) => {
      const allEntries = sorted
        .filter(s => s.date <= session.date)
        .flatMap(s => s.session_entries)
        .filter(e => e.player_id === pid)
      row[playerNames[i]] = allEntries.reduce((sum, e) => sum + e.chips, 0)
    })
    return row
  })
}

export default function LeaderboardView({ stats, sessions }: { stats: PlayerStats[]; sessions: Session[] }) {
  const [view, setView] = useState<'table' | 'chart'>('table')
  const playerNames = stats.map(s => s.player.name)
  const chartData = buildChartData(sessions, stats)

  return (
    <>
      <div className="flex items-baseline justify-between mb-6">
        <div className="flex items-baseline gap-4">
          <h1 className="text-xs text-muted tracking-widest">LEADERBOARD</h1>
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
              <th className="text-right py-3 font-normal">CHIPS</th>
              <th className="text-right py-3 font-normal">CNY</th>
              <th className="text-right py-3 font-normal">SESSIONS</th>
              <th className="text-right py-3 font-normal">WIN%</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr key={s.player.id} className="border-b border-border hover:bg-surface transition-colors">
                <td className="py-4 text-muted text-xs">{i + 1}</td>
                <td className="py-4">
                  <Link href={`/players/${s.player.id}`} className="hover:text-accent transition-colors">
                    {s.player.name}
                  </Link>
                </td>
                <td className="py-4 text-right"><ChipValue chips={s.total_chips} /></td>
                <td className="py-4 text-right">
                  <ChipValue chips={s.total_yuan} prefix="¥" />
                </td>
                <td className="py-4 text-right text-muted">{s.sessions_played}</td>
                <td className="py-4 text-right text-muted">{(s.win_rate * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="-mx-2">
          {sessions.length < 2 ? (
            <p className="text-muted text-xs tracking-widest px-2">Need at least 2 sessions to show chart.</p>
          ) : (
            <LeaderboardChart data={chartData} players={playerNames} />
          )}
        </div>
      )}
    </>
  )
}
