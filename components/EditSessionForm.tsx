'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Player } from '@/types'
import type { SessionForEdit } from '@/lib/queries'
import PlayerSelect from '@/components/PlayerSelect'
import ConfirmModal from '@/components/ConfirmModal'
import ChipValue from '@/components/ChipValue'
import { BUY_IN_UNIT } from '@/lib/synth'

interface BuyInRow { amount: string; created_at?: string }
interface ParticipantRow {
  uid: string
  playerId: string
  name: string
  isNew: boolean
  newName: string
  final: string
  buyins: BuyInRow[]
}

export default function EditSessionForm({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [date, setDate] = useState('')
  const [exchangeRate, setExchangeRate] = useState('')
  const [description, setDescription] = useState('')
  const [rows, setRows] = useState<ParticipantRow[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState<{ diff: number } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<ParticipantRow | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/players').then(r => r.json()),
      fetch(`/api/sessions/${sessionId}`).then(r => r.json()),
    ])
      .then(([ps, s]: [Player[], SessionForEdit]) => {
        setPlayers(ps)
        setDate(s.date ?? '')
        setExchangeRate(s.exchange_rate ? String(s.exchange_rate) : '')
        setDescription(s.description ?? '')
        setRows(s.participants.map(p => ({
          uid: crypto.randomUUID(),
          playerId: p.player_id,
          name: p.name,
          isNew: false,
          newName: '',
          final: p.final_chips != null ? String(p.final_chips) : '',
          buyins: p.buy_ins.map(b => ({ amount: String(b.amount), created_at: b.created_at })),
        })))
        setLoading(false)
      })
      .catch(() => { setLoadError('Failed to load session.'); setLoading(false) })
  }, [sessionId])

  const updateRow = (uid: string, patch: Partial<ParticipantRow>) =>
    setRows(r => r.map(row => row.uid === uid ? { ...row, ...patch } : row))

  function toggle(uid: string) {
    setExpanded(s => {
      const next = new Set(s)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  function addRow() {
    setRows(r => [...r, { uid: crypto.randomUUID(), playerId: '', name: '', isNew: false, newName: '', final: '', buyins: [{ amount: String(BUY_IN_UNIT) }] }])
  }

  function buyinTotal(row: ParticipantRow) {
    return row.buyins.reduce((s, b) => s + (Number(b.amount) || 0), 0)
  }

  const usedIds = rows.map(r => r.playerId).filter(Boolean)
  const totalBuyin = rows.reduce((s, r) => s + buyinTotal(r), 0)
  const totalFinal = rows.reduce((s, r) => s + (Number(r.final) || 0), 0)
  const diff = totalFinal - totalBuyin
  const unit = BUY_IN_UNIT

  async function save(force: boolean) {
    setError('')
    setSaveError(null)
    const valid = rows.filter(r => (r.playerId || r.newName.trim()) && r.final !== '')
    if (valid.length === 0) { setError('Add at least one player.'); return }
    setSubmitting(true)
    try {
      const participants = await Promise.all(valid.map(async row => {
        let player_id = row.playerId
        if (row.isNew && row.newName.trim()) {
          const res = await fetch('/api/players', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: row.newName.trim() }),
          })
          player_id = (await res.json()).id
        }
        return {
          player_id,
          final_chips: Number(row.final),
          buy_ins: row.buyins
            .filter(b => Number(b.amount) > 0)
            .map(b => ({ amount: Number(b.amount), ...(b.created_at ? { created_at: b.created_at } : {}) })),
        }
      }))

      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date, exchange_rate: exchangeRate ? Number(exchangeRate) : 40,
          description: description || null, participants, force,
        }),
      })
      if (res.status === 422) {
        const body = await res.json()
        setSaveError({ diff: body.diff })
        setSubmitting(false)
        return
      }
      if (!res.ok) throw new Error((await res.json()).error ?? 'Save failed')
      router.push(`/sessions/${sessionId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSubmitting(false)
    }
  }

  function requestRemove(row: ParticipantRow) {
    if (!row.playerId && !row.newName.trim()) {
      setRows(r => r.filter(x => x.uid !== row.uid))
      return
    }
    setConfirmRemove(row)
  }
  function doRemove() {
    if (!confirmRemove) return
    setRows(r => r.filter(x => x.uid !== confirmRemove.uid))
    setConfirmRemove(null)
  }

  if (loading) return <p className="text-muted text-xs tracking-widest">LOADING...</p>
  if (loadError) return <p className="text-danger text-xs tracking-widest">{loadError}</p>

  return (
    <>
      <ConfirmModal
        open={confirmRemove !== null}
        title={confirmRemove ? `Remove ${confirmRemove.name || 'this player'}?` : ''}
        description="They will be removed from this session when you save."
        confirmLabel="REMOVE"
        onConfirm={doRemove}
        onCancel={() => setConfirmRemove(null)}
      />

      <div className="mb-6">
        <Link href={`/sessions/${sessionId}`} className="text-muted text-xs hover:text-white tracking-widest">← SESSION</Link>
      </div>
      <h1 className="text-xs text-muted tracking-widest mb-6">EDIT SESSION</h1>

      <div className="flex flex-col gap-6 max-w-lg">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-xs text-muted tracking-widest block mb-2">DATE</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required
              className="w-full bg-surface border border-border text-white text-sm px-4 py-3 outline-none focus:border-white transition-colors" />
          </div>
          <div className="w-32">
            <label className="text-xs text-muted tracking-widest block mb-2">RATE <span className="text-muted">(opt)</span></label>
            <input type="number" value={exchangeRate} onChange={e => setExchangeRate(e.target.value)} placeholder="40" min="1"
              className="w-full bg-surface border border-border text-white text-sm px-4 py-3 outline-none focus:border-white transition-colors placeholder:text-muted" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted tracking-widest block mb-2">DESCRIPTION <span className="text-muted">(opt)</span></label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Friday game"
            className="w-full bg-surface border border-border text-white text-sm px-4 py-3 outline-none focus:border-white transition-colors placeholder:text-muted" />
        </div>

        <div>
          <label className="text-xs text-muted tracking-widest block mb-3">PLAYERS <span className="text-muted">(buy-in · final · net)</span></label>
          <div className="flex flex-col gap-2">
            {rows.map(row => {
              const total = buyinTotal(row)
              const net = (Number(row.final) || 0) - total
              const chosen = !!row.playerId || (row.isNew && !!row.newName.trim())
              return (
                <div key={row.uid} className="border border-border">
                  {!chosen && !row.isNew ? (
                    <div className="flex gap-2 items-center p-2">
                      <PlayerSelect
                        value={row.playerId}
                        players={players.filter(p => !usedIds.includes(p.id) || p.id === row.playerId)}
                        onChange={val => val === '__new__'
                          ? updateRow(row.uid, { isNew: true, playerId: '', newName: '' })
                          : updateRow(row.uid, { playerId: val, name: players.find(p => p.id === val)?.name ?? '' })}
                        className="flex-1"
                      />
                      <button type="button" onClick={() => requestRemove(row)} className="text-muted hover:text-danger text-xs px-2 py-2.5 transition-colors">✕</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        {row.isNew ? (
                          <input type="text" value={row.newName} autoFocus onChange={e => updateRow(row.uid, { newName: e.target.value })}
                            placeholder="new player name"
                            className="flex-1 bg-transparent border-b border-accent text-white text-sm py-1 outline-none placeholder:text-muted" />
                        ) : (
                          <button type="button" onClick={() => toggle(row.uid)} className="flex-1 text-left flex items-baseline gap-2 min-w-0">
                            <span className="text-white truncate">{row.name}</span>
                            <span className="text-xs text-muted">buy-in {total.toLocaleString()} · {row.buyins.length}×</span>
                          </button>
                        )}
                        <input type="number" value={row.final} onChange={e => updateRow(row.uid, { final: e.target.value })}
                          placeholder="final" min="0"
                          className="w-24 bg-surface border border-border text-white text-sm px-3 py-2 outline-none focus:border-white transition-colors placeholder:text-muted text-right" />
                        <span className="w-20 text-right text-sm"><ChipValue chips={net} /></span>
                        <button type="button" onClick={() => requestRemove(row)} className="text-muted hover:text-danger text-sm px-1 transition-colors" aria-label="remove player">✕</button>
                      </div>

                      {expanded.has(row.uid) && !row.isNew && (
                        <div className="border-t border-border px-3 py-2 bg-surface/50">
                          <p className="text-xs text-muted tracking-widest mb-2">BUY-INS</p>
                          <div className="flex flex-col gap-1">
                            {row.buyins.map((b, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <input type="number" value={b.amount} min="1"
                                  onChange={e => updateRow(row.uid, { buyins: row.buyins.map((x, j) => j === i ? { ...x, amount: e.target.value } : x) })}
                                  className="flex-1 bg-surface border border-border text-white text-xs px-3 py-2 outline-none focus:border-white transition-colors text-right" />
                                <button type="button" onClick={() => updateRow(row.uid, { buyins: row.buyins.filter((_, j) => j !== i) })}
                                  className="text-muted hover:text-danger text-xs px-1 transition-colors">✕</button>
                              </div>
                            ))}
                            <button type="button" onClick={() => updateRow(row.uid, { buyins: [...row.buyins, { amount: String(unit) }] })}
                              className="text-xs text-muted hover:text-white tracking-widest text-left py-1.5 transition-colors">+ ADD BUY-IN</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
            <button type="button" onClick={addRow}
              className="text-xs text-muted hover:text-white tracking-widest text-left py-2 transition-colors">+ ADD PLAYER</button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs tracking-widest border-t border-border pt-3">
          <span className="text-muted">Σ FINAL / Σ BUY-IN</span>
          <span className={diff === 0 ? 'text-accent' : 'text-amber-400'}>
            {totalFinal.toLocaleString()} / {totalBuyin.toLocaleString()}
            {diff !== 0 && (
              <span className="ml-2">diff {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                {diff % unit === 0 && ` (= ${diff / unit}×${unit})`}
              </span>
            )}
          </span>
        </div>

        {error && <p className="text-danger text-xs">{error}</p>}
        {saveError && (
          <div className="text-xs text-amber-400">
            Not balanced — diff {saveError.diff > 0 ? '+' : ''}{saveError.diff.toLocaleString()}.
            Double-check buy-ins and final chips; if correct, you can force save (this session will keep an unbalanced record).
            <button onClick={() => save(true)} disabled={submitting}
              className="block mt-2 text-danger tracking-widest hover:underline disabled:opacity-40">FORCE SAVE →</button>
          </div>
        )}

        <button onClick={() => save(false)} disabled={submitting}
          className="bg-white text-bg text-xs font-medium tracking-widest py-3 hover:bg-accent transition-colors disabled:opacity-40">
          {submitting ? 'SAVING...' : 'SAVE CHANGES'}
        </button>
      </div>
    </>
  )
}
