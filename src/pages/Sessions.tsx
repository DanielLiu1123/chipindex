import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { fetchSessions } from '../lib/api'

export default function Sessions() {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSessions()
      .then(setSessions)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Layout>
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-xs text-muted tracking-widest">SESSIONS</h1>
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
              <th className="text-left py-3 font-normal">DATE</th>
              <th className="text-right py-3 font-normal">PLAYERS</th>
              <th className="text-right py-3 font-normal">RATE</th>
              <th className="text-right py-3 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(session => (
              <tr key={session.id} className="border-b border-border hover:bg-surface transition-colors">
                <td className="py-4">{session.date}</td>
                <td className="py-4 text-right text-muted">
                  {session.session_entries?.[0]?.count ?? 0}
                </td>
                <td className="py-4 text-right text-muted">
                  {session.exchange_rate ? `${session.exchange_rate}:1` : '—'}
                </td>
                <td className="py-4 text-right">
                  <Link
                    to={`/sessions/${session.id}`}
                    className="text-xs text-muted hover:text-white tracking-widest transition-colors"
                  >
                    VIEW →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  )
}
