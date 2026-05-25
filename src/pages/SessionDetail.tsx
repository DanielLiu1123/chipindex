import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import ChipValue from '../components/ChipValue'
import { fetchSessionDetail } from '../lib/api'

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    fetchSessionDetail(id)
      .then(setSession)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const entries = session
    ? [...(session.session_entries ?? [])].sort((a: any, b: any) => b.chips - a.chips)
    : []
  const total = entries.reduce((sum: number, e: any) => sum + e.chips, 0)

  return (
    <Layout>
      <div className="mb-6">
        <Link to="/sessions" className="text-muted text-xs hover:text-white tracking-widest">
          ← SESSIONS
        </Link>
      </div>

      {loading && <p className="text-muted text-xs">loading...</p>}
      {error && <p className="text-danger text-xs">{error}</p>}

      {!loading && !error && session && (
        <>
          <div className="flex items-baseline justify-between mb-6">
            <h1 className="text-white">{session.date}</h1>
            <span className="text-xs text-muted">
              {session.exchange_rate ? `${session.exchange_rate} chips = 1 yuan` : 'no rate set'}
            </span>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted text-xs tracking-widest">
                <th className="text-left py-3 font-normal">PLAYER</th>
                <th className="text-right py-3 font-normal">CHIPS</th>
                {session.exchange_rate && (
                  <th className="text-right py-3 font-normal">YUAN</th>
                )}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry: any) => (
                <tr key={entry.id} className="border-b border-border hover:bg-surface transition-colors">
                  <td className="py-4">
                    <Link
                      to={`/players/${entry.player_id}`}
                      className="hover:text-accent transition-colors"
                    >
                      {entry.players?.name ?? entry.player_id}
                    </Link>
                  </td>
                  <td className="py-4 text-right">
                    <ChipValue chips={entry.chips} />
                  </td>
                  {session.exchange_rate && (
                    <td className="py-4 text-right text-muted">
                      <ChipValue chips={Math.round(entry.chips / session.exchange_rate)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-muted text-xs">
                <td className="pt-4">SUM</td>
                <td className="pt-4 text-right">
                  <ChipValue chips={total} />
                </td>
                {session.exchange_rate && <td />}
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </Layout>
  )
}
