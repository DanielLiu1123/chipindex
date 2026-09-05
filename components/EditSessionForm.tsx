'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { SessionForEdit } from '@/lib/queries'
import PlayerSelectionModal from '@/components/PlayerSelectionModal'
import PlayerActionButton from '@/components/PlayerActionButton'
import SessionMetaFields from '@/components/SessionMetaFields'
import ConfirmModal from '@/components/ConfirmModal'
import ChipValue from '@/components/ChipValue'
import { usePlayerDirectory } from '@/lib/use-player-directory'
import type { Player } from '@/lib/domain-types'
import { ApiClientError, updateSession } from '@/lib/client'
import { buyinSum, netChips } from '@/lib/settlement'
import { BUY_IN_UNIT } from '@/lib/synth'

interface BuyInRow { amount: string; created_at: string }
interface ParticipantRow {
  playerId: string
  name: string
  final: string
  buyins: BuyInRow[]
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function toIsoTimestamp(value: string): string {
  return new Date(value).toISOString()
}

function rowsFromSession(session: SessionForEdit): ParticipantRow[] {
  return session.participants.map(participant => ({
    playerId: participant.player_id,
    name: participant.name,
    final: participant.final_chips != null ? String(participant.final_chips) : '',
    buyins: participant.buy_ins.map(buyIn => ({ amount: String(buyIn.amount), created_at: toDateTimeLocal(buyIn.created_at) })),
  }))
}

export default function EditSessionForm({ groupId, sessionId, session, initialPlayers }: {
  groupId: string
  sessionId: string
  session: SessionForEdit
  initialPlayers: Player[]
}) {
  const router = useRouter()
  const [date, setDate] = useState(session.date ?? '')
  const [exchangeRate, setExchangeRate] = useState(session.exchange_rate ? String(session.exchange_rate) : '')
  const [description, setDescription] = useState(session.description ?? '')
  const [rows, setRows] = useState(() => rowsFromSession(session))
  const updateRow = (id: string, patch: Partial<ParticipantRow>) => setRows(current => current.map(row => row.playerId === id ? { ...row, ...patch } : row))
  const [addPlayersOpen, setAddPlayersOpen] = useState(false)
  const directory = usePlayerDirectory({ groupId, players: initialPlayers,
    excludedIds: rows.map(row => row.playerId), excludedMessage: 'This player is already selected.' })
  const saveBusy = useRef(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState<{ diff: number } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<ParticipantRow | null>(null)
  const defaultEventTime = toDateTimeLocal(session.ended_at ?? new Date().toISOString())

  function toggle(playerId: string) {
    setExpanded(s => {
      const next = new Set(s)
      if (next.has(playerId)) next.delete(playerId)
      else next.add(playerId)
      return next
    })
  }

  function addPlayers(ids: string[], amount: number) {
    setRows(current => [...current, ...[...new Set(ids)]
      .filter(id => !current.some(row => row.playerId === id))
      .map(playerId => ({ playerId,
        name: directory.players.find(player => player.id === playerId)?.name ?? playerId, final: '',
        buyins: [{ amount: String(amount), created_at: defaultEventTime }],
      }))])
  }

  function buyinTotal(row: ParticipantRow) {
    return buyinSum(row.buyins.map(b => ({ amount: Number(b.amount) || 0 })))
  }

  const totalBuyin = rows.reduce((s, r) => s + buyinTotal(r), 0)
  const totalFinal = rows.reduce((s, r) => s + (Number(r.final) || 0), 0)
  const diff = totalFinal - totalBuyin
  const unit = BUY_IN_UNIT

  async function save(force: boolean) {
    if (saveBusy.current) return
    setError('')
    setSaveError(null)
    if (rows.length === 0) { setError('Add at least one player.'); return }
    if (rows.some(row => !row.final.trim() || !Number.isSafeInteger(Number(row.final)) || Number(row.final) < 0)) {
      setError('Enter final chips for every player.'); return
    }
    saveBusy.current = true
    setSubmitting(true)
    try {
      const participants = rows.map(row => ({
        player_id: row.playerId,
        final_chips: Number(row.final),
        buy_ins: row.buyins
          .filter(b => Number(b.amount) > 0)
          .map(b => ({ amount: Number(b.amount), created_at: toIsoTimestamp(b.created_at) })),
      }))

      await updateSession(groupId, sessionId, {
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
      saveBusy.current = false
    }
  }

  function doRemove() {
    if (!confirmRemove) return
    setRows(r => r.filter(x => x.playerId !== confirmRemove.playerId))
    setConfirmRemove(null)
  }

  return (
    <>
      <PlayerSelectionModal open={addPlayersOpen} participants={directory.participants}
        onCreatePlayer={directory.create} onClose={() => setAddPlayersOpen(false)}
        action={{ kind: 'draft', unit: BUY_IN_UNIT, submit: addPlayers }} />
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
              return (
                <div key={row.playerId} className="border border-border">
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <button type="button" onClick={() => toggle(row.playerId)} className="flex-1 text-left flex items-baseline gap-2 min-w-0">
                      <span className="text-white truncate">{row.name}</span>
                      <span className="text-xs text-muted">buy-in {total.toLocaleString()} · {row.buyins.length}×</span>
                    </button>
                    <input type="number" value={row.final} disabled={submitting} aria-label={`final chips for ${row.name}`} onChange={e => updateRow(row.playerId, { final: e.target.value })}
                      placeholder="final" min="0"
                      className="w-24 bg-surface border border-border text-white text-sm px-3 py-2 outline-none focus:border-white transition-colors placeholder:text-muted text-right" />
                    <span className="w-20 text-right text-sm"><ChipValue chips={net} /></span>
                    <button type="button" disabled={submitting} onClick={() => setConfirmRemove(row)} className="text-muted hover:text-danger text-sm px-1 transition-colors" aria-label={`remove ${row.name}`}>✕</button>
                  </div>

                  {expanded.has(row.playerId) && (
                    <div className="border-t border-border px-3 py-2 bg-surface/50">
                      <p className="text-xs text-muted tracking-widest mb-2">BUY-INS</p>
                      <div className="flex flex-col gap-1">
                        {row.buyins.map((b, i) => (
                          <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input type="datetime-local" step="1" value={b.created_at}
                              aria-label={`buy-in time for ${row.name}`}
                              onChange={e => updateRow(row.playerId, { buyins: row.buyins.map((x, j) => j === i ? { ...x, created_at: e.target.value } : x) })}
                              className="w-full bg-surface border border-border text-white text-xs px-3 py-2 outline-none focus:border-white transition-colors sm:w-52" />
                            <input type="number" value={b.amount} min="1"
                              onChange={e => updateRow(row.playerId, { buyins: row.buyins.map((x, j) => j === i ? { ...x, amount: e.target.value } : x) })}
                              className="flex-1 bg-surface border border-border text-white text-xs px-3 py-2 outline-none focus:border-white transition-colors text-right" />
                            <button type="button" onClick={() => updateRow(row.playerId, { buyins: row.buyins.filter((_, j) => j !== i) })}
                              className="text-muted hover:text-danger text-xs px-1 transition-colors">✕</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => updateRow(row.playerId, { buyins: [...row.buyins, { amount: String(unit), created_at: defaultEventTime }] })}
                          className="text-xs text-muted hover:text-white tracking-widest text-left py-1.5 transition-colors">+ ADD BUY-IN</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            <PlayerActionButton action="add-player" disabled={submitting} onClick={() => setAddPlayersOpen(true)} />
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
