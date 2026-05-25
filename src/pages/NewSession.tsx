import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { fetchPlayers, createPlayer, createSession } from '../lib/api'
import type { Player } from '../types'

interface EntryRow {
  playerId: string
  chips: string
  isNew: boolean
  newName: string
}

export default function NewSession() {
  const navigate = useNavigate()
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [exchangeRate, setExchangeRate] = useState('')
  const [rows, setRows] = useState<EntryRow[]>([
    { playerId: '', chips: '', isNew: false, newName: '' },
  ])
  const [players, setPlayers] = useState<Player[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPlayers().then(setPlayers).catch(e => setError(e.message))
  }, [])

  function addRow() {
    setRows(r => [...r, { playerId: '', chips: '', isNew: false, newName: '' }])
  }

  function removeRow(i: number) {
    setRows(r => r.filter((_, idx) => idx !== i))
  }

  function updateRow(i: number, patch: Partial<EntryRow>) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const validRows = rows.filter(r => (r.playerId || r.newName.trim()) && r.chips !== '')
    if (validRows.length === 0) {
      setError('Add at least one player entry.')
      return
    }

    setSubmitting(true)
    try {
      const resolvedEntries = await Promise.all(
        validRows.map(async row => {
          let playerId = row.playerId
          if (row.isNew && row.newName.trim()) {
            const newPlayer = await createPlayer(row.newName.trim())
            playerId = newPlayer.id
          }
          return { playerId, chips: Number(row.chips) }
        })
      )

      await createSession(
        date,
        exchangeRate ? Number(exchangeRate) : null,
        resolvedEntries
      )

      navigate('/sessions')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const usedPlayerIds = rows.map(r => r.playerId).filter(Boolean)

  return (
    <Layout>
      <div className="mb-6">
        <Link to="/sessions" className="text-muted text-xs hover:text-white tracking-widest">
          ← SESSIONS
        </Link>
      </div>

      <h1 className="text-xs text-muted tracking-widest mb-6">NEW SESSION</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-lg">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs text-muted tracking-widest block mb-2">DATE</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className="w-full bg-surface border border-border text-white text-sm px-4 py-3 outline-none focus:border-white transition-colors"
            />
          </div>
          <div className="w-32">
            <label className="text-xs text-muted tracking-widest block mb-2">
              RATE <span className="text-muted">(opt)</span>
            </label>
            <input
              type="number"
              value={exchangeRate}
              onChange={e => setExchangeRate(e.target.value)}
              placeholder="e.g. 10"
              min="1"
              className="w-full bg-surface border border-border text-white text-sm px-4 py-3 outline-none focus:border-white transition-colors placeholder:text-muted"
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted tracking-widest block mb-3">PLAYERS</label>
          <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <div key={i} className="flex gap-2 items-center">
                {row.isNew ? (
                  <input
                    type="text"
                    value={row.newName}
                    onChange={e => updateRow(i, { newName: e.target.value })}
                    placeholder="new player name"
                    className="flex-1 bg-surface border border-accent text-white text-sm px-4 py-2.5 outline-none focus:border-white transition-colors placeholder:text-muted"
                  />
                ) : (
                  <select
                    value={row.playerId}
                    onChange={e => {
                      if (e.target.value === '__new__') {
                        updateRow(i, { isNew: true, playerId: '', newName: '' })
                      } else {
                        updateRow(i, { playerId: e.target.value })
                      }
                    }}
                    className="flex-1 bg-surface border border-border text-white text-sm px-4 py-2.5 outline-none focus:border-white transition-colors"
                  >
                    <option value="">select player</option>
                    {players
                      .filter(p => !usedPlayerIds.includes(p.id) || p.id === row.playerId)
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    <option value="__new__">+ new player</option>
                  </select>
                )}
                <input
                  type="number"
                  value={row.chips}
                  onChange={e => updateRow(i, { chips: e.target.value })}
                  placeholder="chips (±)"
                  className="w-28 bg-surface border border-border text-white text-sm px-4 py-2.5 outline-none focus:border-white transition-colors placeholder:text-muted"
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="text-muted hover:text-danger text-xs px-2 py-2.5 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addRow}
              className="text-xs text-muted hover:text-white tracking-widest text-left py-2 transition-colors"
            >
              + ADD PLAYER
            </button>
          </div>
        </div>

        {error && <p className="text-danger text-xs">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="bg-white text-bg text-xs font-medium tracking-widest py-3 hover:bg-accent transition-colors disabled:opacity-40"
        >
          {submitting ? 'SAVING...' : 'SAVE SESSION'}
        </button>
      </form>
    </Layout>
  )
}
