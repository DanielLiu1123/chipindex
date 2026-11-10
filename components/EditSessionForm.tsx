'use client'

import { ChevronRight, Plus } from 'lucide-react'
import styles from './EditSessionForm.module.css'
import { Alert, AlertDescription } from '@/components/ui/alert'

import DeleteIconButton from '@/components/DeleteIconButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { errorMessage } from '@/lib/error-message'
import { DEFAULT_EXCHANGE_RATE, BUY_IN_UNIT } from '@/lib/session-rules'
import { toDateTimeLocal, toIsoTimestamp } from '@/lib/browser-time'
import { useBrowserReady } from '@/lib/use-browser-ready'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SessionForEdit } from '@/lib/domain-types'
import PlayerSelectionModal from '@/components/PlayerSelectionModal'
import SessionPlayersHeader from '@/components/SessionPlayersHeader'
import SessionMetaFields from '@/components/SessionMetaFields'
import ConfirmModal from '@/components/ConfirmModal'
import ChipValue from '@/components/ChipValue'
import { usePlayerDirectory } from '@/lib/use-player-directory'
import type { Player } from '@/lib/domain-types'
import { ApiClientError, updateSession } from '@/lib/client'
import { buyinSum, netChips } from '@/lib/settlement'

interface BuyInRow { id?: string; original_created_at?: string; amount: string; created_at: string }
interface ParticipantRow {
  playerId: string
  name: string
  final: string
  buyins: BuyInRow[]
}

function validBuyInTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return false
  try {
    return toDateTimeLocal(toIsoTimestamp(value)) === (value.length === 16 ? `${value}:00` : value)
  } catch {
    return false
  }
}

function rowsFromSession(session: SessionForEdit): ParticipantRow[] {
  return session.participants.map(participant => ({
    playerId: participant.player_id,
    name: participant.name,
    final: participant.final_chips != null ? String(participant.final_chips) : '',
    buyins: participant.buy_ins.map(buyIn => ({ id: buyIn.id, original_created_at: buyIn.created_at, amount: String(buyIn.amount), created_at: toDateTimeLocal(buyIn.created_at) })),
  }))
}

function EditSessionEditor({ groupId, sessionId, session, initialPlayers }: {
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

  async function addPlayers(ids: string[]) {
    setRows(current => [...current, ...[...new Set(ids)]
      .filter(id => !current.some(row => row.playerId === id))
      .map(playerId => ({ playerId,
        name: directory.players.find(player => player.id === playerId)?.name ?? playerId, final: '',
        buyins: [],
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
    if (rows.some(row => row.buyins.some(buyIn => !buyIn.amount.trim() || !Number.isSafeInteger(Number(buyIn.amount)) || Number(buyIn.amount) <= 0 || !validBuyInTime(buyIn.created_at)))) {
      setError('Every buy-in needs a positive integer amount and a valid time.'); return
    }
    saveBusy.current = true
    setSubmitting(true)
    try {
      const participants = rows.map(row => ({
        player_id: row.playerId,
        final_chips: Number(row.final),
        buy_ins: row.buyins
          .map(b => ({ ...(b.id ? { id: b.id } : {}), amount: Number(b.amount), created_at: b.original_created_at && b.created_at === toDateTimeLocal(b.original_created_at) ? b.original_created_at : toIsoTimestamp(b.created_at) })),
      }))

      await updateSession(groupId, sessionId, {
        date,
        exchange_rate: exchangeRate ? Number(exchangeRate) : DEFAULT_EXCHANGE_RATE,
        description: description || null,
        participants,
        force,
      })
      router.push(`/groups/${groupId}/sessions/${sessionId}`)
      router.refresh()
    } catch (err) {
      if (err instanceof ApiClientError && err.payload.code === 'unbalanced' && typeof err.payload.diff === 'number') {
        setSaveError({ diff: Number(err.payload.diff) })
      } else {
        setError(errorMessage(err))
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
        action={{ kind: 'players', submit: addPlayers }} />
      <ConfirmModal
        open={confirmRemove !== null}
        title={confirmRemove ? `Remove ${confirmRemove.name || 'this player'}?` : ''}
        description="They will be removed from this session when you save."
        confirmLabel="REMOVE"
        onConfirm={doRemove}
        onCancel={() => setConfirmRemove(null)}
      />

      <h1 className="text-2xl font-medium tracking-tight mb-6">EDIT SESSION</h1>

      <div className={styles.editor}>
        <SessionMetaFields disabled={submitting}
          date={date} setDate={setDate}
          exchangeRate={exchangeRate} setExchangeRate={setExchangeRate}
          description={description} setDescription={setDescription}
        />

        <div>
          <SessionPlayersHeader disabled={submitting} onAdd={() => setAddPlayersOpen(true)} />
          <div className={styles.table}>
            <div className={styles.heading} aria-hidden="true"><span /><span>PLAYER</span><span className={styles.buyin}>BUY-IN</span><span>FINAL CHIPS</span><span className={styles.net}>NET</span><span /></div>
            {rows.map(row => {
              const total = buyinTotal(row)
              const net = netChips(Number(row.final) || 0, total)
              return (
                <div key={row.playerId} className={styles.participant}>
                  <div className={styles.row} onClick={event => {
                    if (!submitting && !(event.target as HTMLElement).closest('button, input, label')) toggle(row.playerId)
                  }}>
                    <Button variant="ghost" type="button" size="icon-sm" disabled={submitting}
                      aria-label={`Buy-ins for ${row.name}`} aria-expanded={expanded.has(row.playerId)}
                      aria-controls={`buyins-${row.playerId}`} onClick={() => toggle(row.playerId)}>
                      <ChevronRight className={expanded.has(row.playerId) ? 'rotate-90' : ''} aria-hidden="true" />
                    </Button>
                    <span className="truncate text-sm" title={row.name}>{row.name}</span>
                    <span className={styles.buyin}>{total.toLocaleString()} ({row.buyins.length})</span>
                    <Input type="number" value={row.final} disabled={submitting} aria-label={`final chips for ${row.name}`} onChange={e => updateRow(row.playerId, { final: e.target.value })}
                      placeholder="final" min="0" className="min-w-0 text-right" />
                    <span className={styles.net}><ChipValue chips={net} /></span>
                    <DeleteIconButton disabled={submitting} onClick={() => setConfirmRemove(row)} label={`remove ${row.name}`} />
                  </div>

                  {expanded.has(row.playerId) && (
                    <div id={`buyins-${row.playerId}`} className="border-t border-border p-3 bg-muted/50">
                      <div className={styles.detailsSummary}><span className="break-all">{row.name}</span><span className={styles.hiddenBuyin}>BUY-IN {total.toLocaleString()} ({row.buyins.length})</span><span>NET <ChipValue chips={net} /></span></div>
                      <div className="flex flex-col gap-1">
                        {row.buyins.map((b, i) => (
                          <div key={i} className={styles.buyinRow}>
                            <Input disabled={submitting} type="text" placeholder="yyyy-MM-dd HH:mm:ss" value={b.created_at.replace('T', ' ')}
                              aria-label={`buy-in time for ${row.name}`}
                              onChange={e => updateRow(row.playerId, { buyins: row.buyins.map((x, j) => j === i ? { ...x, created_at: e.target.value.replace(' ', 'T') } : x) })}
                              className="min-w-0" />
                            <Input disabled={submitting} type="number" value={b.amount} min="1" aria-label={`buy-in chips for ${row.name}`}
                              onChange={e => updateRow(row.playerId, { buyins: row.buyins.map((x, j) => j === i ? { ...x, amount: e.target.value } : x) })}
                              className="min-w-0 text-right" />
                            <DeleteIconButton disabled={submitting} onClick={() => updateRow(row.playerId, { buyins: row.buyins.filter((_, j) => j !== i) })}
                              label={`remove buy-in ${i + 1} for ${row.name}`} />
                          </div>
                        ))}
                        <Button variant="outline" disabled={submitting} type="button" onClick={() => updateRow(row.playerId, { buyins: [...row.buyins, { amount: String(unit), created_at: defaultEventTime }] })}
                          className="mt-2 h-8 w-fit text-xs"><Plus className="size-3.5" aria-hidden="true" /> ADD</Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs tracking-normal border-t border-border pt-3">
          <span className="text-muted-foreground">Σ FINAL / POT</span>
          <span className={diff === 0 ? 'text-primary' : 'text-amber-700 dark:text-amber-400'}>
            {totalFinal.toLocaleString()} / {totalBuyin.toLocaleString()}
            {diff !== 0 && (
              <span className="ml-2">diff {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                {diff % unit === 0 && ` (= ${diff / unit}×${unit})`}
              </span>
            )}
          </span>
        </div>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {saveError && (
          <div className="text-xs text-amber-700 dark:text-amber-400">
            Not balanced — diff {saveError.diff > 0 ? '+' : ''}{saveError.diff.toLocaleString()}.
            Double-check buy-ins and final chips; if correct, you can force save (this session will keep an unbalanced record).
            <Button variant="destructive" type="button" onClick={() => save(true)} disabled={submitting}
              className="mt-2">FORCE SAVE →</Button>
          </div>
        )}

        <Button variant="default" type="button" onClick={() => save(false)} disabled={submitting}
          >
          {submitting ? 'SAVING...' : 'SAVE CHANGES'}
        </Button>
      </div>
    </>
  )
}

export default function EditSessionForm(props: Parameters<typeof EditSessionEditor>[0]) {
  const ready = useBrowserReady()
  return ready ? <EditSessionEditor {...props} /> : <p className="text-xs text-muted-foreground">LOADING...</p>
}
