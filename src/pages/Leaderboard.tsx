import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import ChipValue from '../components/ChipValue'
import { fetchLeaderboard } from '../lib/api'
import type { PlayerStats } from '../types'

export default function Leaderboard() {
  const [stats, setStats] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchLeaderboard()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Layout>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-xs text-muted tracking-widest">LEADERBOARD</h1>
        <Link to="/sessions/new" className="text-xs text-accent tracking-widest hover:underline">
          + NEW SESSION
        </Link>
      </div>

      {loading && <p className="text-muted text-xs">loading...</p>}
      {error && <p className="text-danger text-xs">{error}</p>}

      {!loading && !error && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted text-xs tracking-widest">
              <th className="text-left py-3 font-normal w-8">#</th>
              <th className="text-left py-3 font-normal">PLAYER</th>
              <th className="text-right py-3 font-normal">CHIPS</th>
              <th className="text-right py-3 font-normal">SESSIONS</th>
              <th className="text-right py-3 font-normal">WIN%</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr key={s.player.id} className="border-b border-border hover:bg-surface transition-colors">
                <td className="py-4 text-muted text-xs">{i + 1}</td>
                <td className="py-4">
                  <Link to={`/players/${s.player.id}`} className="hover:text-accent transition-colors">
                    {s.player.name}
                  </Link>
                </td>
                <td className="py-4 text-right">
                  <ChipValue chips={s.total_chips} />
                </td>
                <td className="py-4 text-right text-muted">{s.sessions_played}</td>
                <td className="py-4 text-right text-muted">
                  {(s.win_rate * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  )
}
