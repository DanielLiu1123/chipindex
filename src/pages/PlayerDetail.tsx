import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import Layout from '../components/Layout'
import ChipValue from '../components/ChipValue'
import { fetchPlayerDetail } from '../lib/api'

export default function PlayerDetail() {
  const { id } = useParams<{ id: string }>()
  const [player, setPlayer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    fetchPlayerDetail(id)
      .then(setPlayer)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const sessions: any[] = player
    ? [...(player.session_entries ?? [])]
        .filter((e: any) => e.sessions)
        .sort((a: any, b: any) => a.sessions.date.localeCompare(b.sessions.date))
    : []

  let cumulative = 0
  const history = sessions.map((e: any) => {
    cumulative += e.chips
    return { date: e.sessions.date, chips: e.chips, cumulative }
  })

  const totalChips = history.length > 0 ? history[history.length - 1].cumulative : 0
  const wins = sessions.filter((e: any) => e.chips > 0).length

  return (
    <Layout>
      <div className="mb-6">
        <Link to="/" className="text-muted text-xs hover:text-white tracking-widest">
          ← LEADERBOARD
        </Link>
      </div>

      {loading && <p className="text-muted text-xs">loading...</p>}
      {error && <p className="text-danger text-xs">{error}</p>}

      {!loading && !error && player && (
        <>
          <div className="flex items-baseline justify-between mb-8">
            <h1 className="text-white text-lg">{player.name}</h1>
            <div className="flex gap-6 text-xs text-muted">
              <span>{sessions.length} sessions</span>
              <span>{wins} wins</span>
              <ChipValue chips={totalChips} className="text-sm" />
            </div>
          </div>

          {history.length > 1 && (
            <div className="mb-10 -mx-2">
              <p className="text-xs text-muted tracking-widest mb-4 mx-2">CUMULATIVE CHIPS</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={history}>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#666666', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#666666', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    axisLine={false}
                    tickLine={false}
                    width={50}
                  />
                  <ReferenceLine y={0} stroke="#333333" strokeDasharray="3 3" />
                  <Tooltip
                    contentStyle={{
                      background: '#111111',
                      border: '1px solid #222222',
                      borderRadius: 0,
                      fontFamily: 'JetBrains Mono',
                      fontSize: 12,
                      color: '#ffffff',
                    }}
                    formatter={(value) => [
                      typeof value === 'number' && value > 0 ? `+${value}` : value,
                      'cumulative',
                    ]}
                  />
                  <Line
                    type="linear"
                    dataKey="cumulative"
                    stroke={totalChips >= 0 ? '#00ff88' : '#ff4444'}
                    strokeWidth={1.5}
                    dot={{ r: 3, fill: totalChips >= 0 ? '#00ff88' : '#ff4444', strokeWidth: 0 }}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <p className="text-xs text-muted tracking-widest mb-4">SESSION HISTORY</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs tracking-widest">
                <th className="text-left py-3 font-normal">DATE</th>
                <th className="text-right py-3 font-normal">CHIPS</th>
                <th className="text-right py-3 font-normal">CUMULATIVE</th>
              </tr>
            </thead>
            <tbody>
              {[...history].reverse().map((row, i) => (
                <tr key={i} className="border-b border-border hover:bg-surface transition-colors">
                  <td className="py-4">
                    <Link
                      to={`/sessions/${sessions[sessions.length - 1 - i]?.session_id}`}
                      className="hover:text-accent transition-colors"
                    >
                      {row.date}
                    </Link>
                  </td>
                  <td className="py-4 text-right">
                    <ChipValue chips={row.chips} />
                  </td>
                  <td className="py-4 text-right">
                    <ChipValue chips={row.cumulative} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Layout>
  )
}
