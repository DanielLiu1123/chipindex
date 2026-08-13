'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { SessionForEdit } from '@/lib/queries'
import PlayerRowPicker from '@/components/PlayerRowPicker'
import SessionMetaFields from '@/components/SessionMetaFields'
import ConfirmModal from '@/components/ConfirmModal'
import ChipValue from '@/components/ChipValue'
import { usePlayerRows, resolvePlayerId, type PlayerRowBase } from '@/hooks/usePlayerRows'
import { api, ApiClientError } from '@/lib/client'
import { buyinSum, netChips } from '@/lib/settlement'
import { BUY_IN_UNIT } from '@/lib/synth'
import { uid } from '@/lib/uid'

interface BuyInRow { amount: string; created_at?: string }
interface ParticipantRow extends PlayerRowBase {
  name: string
  final: string
  buyins: BuyInRow[]
}

export default function EditSessionForm({ groupId, sessionId }: { groupId: string; sessionId: string }) {
  const router = useRouter()
  const [date, setDate] = useState('')
  const [exchangeRate, setExchangeRate] = useState('')
  const [description, setDescription] = useState('')
  const { rows, setRows, updateRow, usedIds, players, playersLoading, playersError } = usePlayerRows<ParticipantRow>(groupId, [])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [sessionLoading, setSessionLoading] = useState(true)
  const [sessionError, setSessionError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState<{ diff: number } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<ParticipantRow | null>(null)

  useEffect(() => {
    api<SessionForEdit>('GET', `/api/groups/${groupId}/sessions/${sessionId}`)
      .then(s => {
        setDate(s.date ?? '')
        setExchangeRate(s.exchange_rate ? String(s.exchange_rate) : '')
        setDescription(s.description ?? '')
        setRows(s.participants.map(p => ({
          uid: uid(),
          playerId: p.player_id,
          name: p.name,
          isNew: false,
          newName: '',
          final: p.final_chips != null ? String(p.final_chips) : '',
          buyins: p.buy_ins.map(b => ({ amount: String(b.amount), created_at: b.created_at })),
        })))
      })
      .catch(() => setSessionError('Failed to load session.'))
      .finally(() => setSessionLoading(false))
  }, [groupId, sessionId, setRows])

  function toggle(uid: string) {
    setExpanded(s => {
      const next = new Set(s)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  function addRow() {
    setRows(r => [...r, { uid: uid(), playerId: '', name: '', isNew: false, newName: '', final: '', buyins: [{ amount: String(BUY_IN_UNIT) }] }])
  }

  function buyinTotal(row: ParticipantRow) {
    return buyinSum(row.buyins.map(b => ({ amount: Number(b.amount) || 0 })))
  }

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
      const participants = await Promise.all(valid.map(async row => ({
        player_id: await resolvePlayerId(groupId, row),
        final_chips: Number(row.final),
        buy_ins: row.buyins
          .filter(b => Number(b.amount) > 0)
          .map(b => ({ amount: Number(b.amount), ...(b.created_at ? { created_at: b.created_at } : {}) })),
      })))

      await api('PUT', `/api/groups/${groupId}/sessions/${sessionId}`, {
        date,
        exchange_rate: exchangeRate ? Number(exchangeRate) : 40,
        description: description || null,
        participants,
        force,
      })
      router.push(`/groups/${groupId}/sessions/${sessionId}`)
      router.refresh()
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 422) {
        setSaveError({ diff: Number(err.payload.diff) })
      } else {
        setError(err instanceof Error ? err.message : 'Save failed')
      }
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

  if (playersLoading || sessionLoading) return <p className="text-muted text-xs tracking-widest">LOADING...</p>
  if (playersError || sessionError) return <p className="text-danger text-xs tracking-widest">{playersError || sessionError}</p>

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
        <Link href={`/groups/${groupId}/sessions/${sessionId}`} className="text-muted text-xs hover:text-white tracking-widest">← SESSION</Link>
      </div>
      <h1 className="text-xs text-muted tracking-widest mb-6">EDIT SESSION</h1>

      <div className="flex flex-col gap-6 max-w-lg">
        <SessionMetaFields
          date={date} setDate={setDate}
          exchangeRate={exchangeRate} setExchangeRate={setExchangeRate}
          description={description} setDescription={setDescription}
        />

        <div>
          <label className="text-xs text-muted tracking-widest block mb-3">PLAYERS <span className="text-muted">(buy-in · final · net)</span></label>
          <div className="flex flex-col gap-2">
            {rows.map(row => {
              const total = buyinTotal(row)
              const net = netChips(Number(row.final) || 0, total)
              const chosen = !!row.playerId || (row.isNew && !!row.newName.trim())
              return (
                <div key={row.uid} className="border border-border">
                  {!chosen && !row.isNew ? (
                    <div className="flex gap-2 items-center p-2">
                      <PlayerRowPicker row={row} players={players} usedIds={usedIds}
                        onPatch={patch => updateRow(row.uid, {
                          ...patch,
                          ...(patch.playerId ? { name: players.find(p => p.id === patch.playerId)?.name ?? '' } : {}),
                        })} />
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
