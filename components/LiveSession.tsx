'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PlayerSelect from '@/components/PlayerSelect'
import ConfirmModal from '@/components/ConfirmModal'
import CashOutModal from '@/components/CashOutModal'
import ChipValue from '@/components/ChipValue'
import type { Player } from '@/types'
import type { LiveSessionData, LiveParticipant } from '@/lib/queries'
import {
  addBuyIn as createBuyIn,
  ApiClientError,
  cashOutSessionParticipant,
  createPlayerInGroup,
  removeSessionParticipant,
  revokeBuyIn,
  settleSession,
  undoSessionParticipantCashOut,
} from '@/lib/client'

export default function LiveSession({ groupId, session, allPlayers }: { groupId: string; session: LiveSessionData; allPlayers: Player[] }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [custom, setCustom] = useState<Record<string, string>>({})
  const [addId, setAddId] = useState('')
  const [newName, setNewName] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [settling, setSettling] = useState(false)
  const [finals, setFinals] = useState<Record<string, string>>({})
  const [settleError, setSettleError] = useState<{ diff: number } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<LiveParticipant | null>(null)
  const [cashOut, setCashOut] = useState<LiveParticipant | null>(null)
  const [cashOutError, setCashOutError] = useState('')
  const [error, setError] = useState('')

  const unit = session.buy_in_unit
  const pot = session.participants.reduce((s, p) => s + p.total_buyin, 0)
  const cashedOutTotal = session.participants.reduce((sum, participant) =>
    sum + (participant.settled_at !== null ? participant.final_chips ?? 0 : 0), 0)
  const usedIds = session.participants.map(p => p.player_id)
  const availablePlayers = allPlayers.filter(p => !usedIds.includes(p.id))

  // Runs a mutation against the API, refreshing the page data on success and
  // surfacing the error message on failure.
  async function act(fn: () => Promise<unknown>) {
    setPending(true)
    setError('')
    try {
      await fn()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setPending(false)
    }
  }

  const addBuyIn = (player_id: string, amount: number) =>
    act(() => createBuyIn(groupId, session.id, { player_id, amount }))

  const undoBuyIn = (buyinId: string) =>
    act(() => revokeBuyIn(groupId, session.id, buyinId))

  const removeParticipant = (player_id: string) =>
    act(() => removeSessionParticipant(groupId, session.id, player_id))

  async function doRemove() {
    if (!confirmRemove) return
    const pid = confirmRemove.player_id
    setConfirmRemove(null)
    await removeParticipant(pid)
  }

  async function doCashOut(finalChips: number) {
    if (!cashOut) return
    setPending(true)
    setCashOutError('')
    try {
      await cashOutSessionParticipant(groupId, session.id, { player_id: cashOut.player_id, final_chips: finalChips })
      setCashOut(null)
      router.refresh()
    } catch (e) {
      setCashOutError(e instanceof Error ? e.message : `Could not cash out ${cashOut.name}. Please try again.`)
    } finally {
      setPending(false)
    }
  }

  const undoCashOut = (playerId: string) =>
    act(() => undoSessionParticipantCashOut(groupId, session.id, playerId))

  function addCustom(player_id: string) {
    const v = Number(custom[player_id])
    if (!Number.isInteger(v) || v <= 0) return
    setCustom(c => ({ ...c, [player_id]: '' }))
    addBuyIn(player_id, v)
  }

  async function addExisting(player_id: string) {
    // Joining grants an initial buy-in (= buy_in_unit); the participant is lazily created by the buy-in endpoint
    await act(() => createBuyIn(groupId, session.id, { player_id, amount: unit }))
    setAddId('')
  }

  async function addNewPlayer() {
    const name = newName.trim()
    if (!name) return
    await act(async () => {
      const { player } = await createPlayerInGroup(groupId, name)
      await createBuyIn(groupId, session.id, { player_id: player.id, amount: unit })
      setNewName('')
      setAddingNew(false)
    })
  }

  function toggleExpand(player_id: string) {
    setExpanded(s => {
      const next = new Set(s)
      if (next.has(player_id)) next.delete(player_id)
      else next.add(player_id)
      return next
    })
  }

  // ── settle ────────────────────────────────────────────
  const totalFinal = session.participants.reduce((sum, participant) => sum + (
    participant.settled_at !== null
      ? participant.final_chips ?? 0
      : Number(finals[participant.player_id]) || 0
  ), 0)
  const settleDiff = totalFinal - pot
  const allFinalsFilled = session.participants.every(p =>
    p.settled_at !== null || (finals[p.player_id] !== undefined && finals[p.player_id] !== ''))

  async function submitSettle(force: boolean) {
    setPending(true)
    setError('')
    setSettleError(null)
    try {
      await settleSession(groupId, session.id, {
        finals: session.participants
          .filter(participant => participant.settled_at === null)
          .map(participant => ({ player_id: participant.player_id, final_chips: Number(finals[participant.player_id]) })),
        force,
      })
      router.push(`/groups/${groupId}/sessions/${session.id}`)
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 422) {
        setSettleError({ diff: Number(e.payload.diff) })
      } else {
        setError(e instanceof Error ? e.message : 'Settle failed')
      }
      setPending(false)
    }
  }

  return (
    <>
      <ConfirmModal
        open={confirmRemove !== null}
        title={confirmRemove ? `Remove ${confirmRemove.name}?` : ''}
        description={confirmRemove ? `This will delete their ${confirmRemove.buy_ins.length} buy-in(s) (${confirmRemove.total_buyin.toLocaleString()} chips).` : undefined}
        confirmLabel="REMOVE"
        onConfirm={doRemove}
        onCancel={() => setConfirmRemove(null)}
      />
      <CashOutModal
        participant={cashOut}
        pending={pending}
        error={cashOutError}
        onConfirm={doCashOut}
        onCancel={() => { setCashOut(null); setCashOutError('') }}
      />
      <div className="mb-6">
        <Link href={`/groups/${groupId}/sessions`} className="text-muted text-xs hover:text-white tracking-widest">← SESSIONS</Link>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
        <span className="text-xs text-accent tracking-widest">LIVE</span>
        <span className="text-white">{session.date}</span>
        {session.description && <span className="text-sm text-muted">· {session.description}</span>}
      </div>
      <div className="mb-6 flex items-baseline gap-2">
        <span className="text-xs text-muted tracking-widest">POT (TOTAL BUY-IN)</span>
        <span className="text-accent text-lg">{pot.toLocaleString()}</span>
        <span className="text-xs text-muted">chips</span>
      </div>
      {cashedOutTotal > 0 && (
        <div className="-mt-5 mb-6 flex items-baseline gap-2">
          <span className="text-xs text-muted tracking-widest">CASHED OUT</span>
          <span className="text-white text-sm">{cashedOutTotal.toLocaleString()}</span>
          <span className="text-xs text-muted">chips</span>
        </div>
      )}

      {error && <p className="text-danger text-xs mb-4">{error}</p>}

      {/* participants + buy-ins */}
      <div className="flex flex-col gap-1 mb-6">
        {session.participants.length === 0 && (
          <p className="text-muted text-xs tracking-widest py-6 text-center">NO PLAYERS YET — ADD SOMEONE BELOW</p>
        )}
        {session.participants.map(p => {
          const isCashedOut = p.settled_at !== null
          return (
          <div key={p.player_id} className={`border border-border ${isCashedOut ? 'bg-surface/40' : ''}`}>
            <div className="flex items-center gap-2 px-3 py-2.5">
              <button onClick={() => toggleExpand(p.player_id)} className="flex-1 text-left flex items-baseline gap-2 min-w-0">
                <span className="text-white truncate">{p.name}</span>
                {isCashedOut ? (
                  <span className="text-xs text-muted whitespace-nowrap">CASHED OUT · {new Date(p.settled_at!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                ) : <span className="text-xs text-muted">{p.buy_ins.length}×</span>}
              </button>
              {isCashedOut ? (
                <span className="text-xs whitespace-nowrap"><ChipValue chips={(p.final_chips ?? 0) - p.total_buyin} /></span>
              ) : <span className="text-sm text-white tabular-nums">{p.total_buyin.toLocaleString()}</span>}
              {!settling && !isCashedOut && (
                <>
                  <button onClick={() => addBuyIn(p.player_id, unit)} disabled={pending}
                    className="text-xs text-accent border border-accent/40 hover:border-accent px-2 py-1 tracking-widest transition-colors disabled:opacity-40">
                    +{unit.toLocaleString()}
                  </button>
                  <button onClick={() => { setCashOutError(''); setCashOut(p) }} disabled={pending}
                    className="text-xs text-amber-400 border border-amber-400/40 hover:border-amber-400 px-2 py-1 tracking-widest transition-colors disabled:opacity-40">
                    CASH OUT
                  </button>
                  <button onClick={() => setConfirmRemove(p)} disabled={pending}
                    className="text-muted hover:text-danger text-sm px-1 transition-colors disabled:opacity-40" aria-label="remove player">
                    ✕
                  </button>
                </>
              )}
              {!settling && isCashedOut && (
                <button onClick={() => undoCashOut(p.player_id)} disabled={pending}
                  className="text-xs text-muted hover:text-white px-1 tracking-widest transition-colors disabled:opacity-40">
                  UNDO
                </button>
              )}
            </div>

            {isCashedOut && (
              <div className="px-3 pb-2.5 text-xs text-muted">
                Buy-in {p.total_buyin.toLocaleString()} · Final {(p.final_chips ?? 0).toLocaleString()} · Net {(p.final_chips ?? 0) - p.total_buyin >= 0 ? '+' : ''}{((p.final_chips ?? 0) - p.total_buyin).toLocaleString()}
              </div>
            )}

            {expanded.has(p.player_id) && !settling && (
              <div className="border-t border-border px-3 py-2 bg-surface/50">
                {p.buy_ins.length > 0 && (
                  <div className="flex flex-col gap-1 mb-2">
                    {p.buy_ins.map(b => (
                      <div key={b.id} className="flex items-center justify-between text-xs text-muted">
                        <span>{new Date(b.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · +{b.amount.toLocaleString()}</span>
                        {!isCashedOut && (
                          <button onClick={() => undoBuyIn(b.id)} disabled={pending}
                            className="hover:text-danger transition-colors px-1">✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {!isCashedOut && <div className="flex items-center gap-2">
                  <input type="number" inputMode="numeric" value={custom[p.player_id] ?? ''} min="1"
                    onChange={e => setCustom(c => ({ ...c, [p.player_id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') addCustom(p.player_id) }}
                    placeholder="custom amount"
                    className="flex-1 bg-surface border border-border text-white text-xs px-3 py-2 outline-none focus:border-white transition-colors placeholder:text-muted" />
                  <button onClick={() => addCustom(p.player_id)} disabled={pending}
                    className="text-xs text-accent tracking-widest px-2 py-2 hover:underline disabled:opacity-40">ADD</button>
                </div>}
              </div>
            )}
          </div>
        )})}
      </div>

      {/* add player */}
      {!settling && (
        <div className="mb-8">
          {addingNew ? (
            <div className="flex gap-2 items-center">
              <input type="text" value={newName} autoFocus
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addNewPlayer() }}
                placeholder="new player name"
                className="flex-1 bg-surface border border-accent text-white text-sm px-4 py-2.5 outline-none focus:border-white transition-colors placeholder:text-muted" />
              <button onClick={addNewPlayer} disabled={pending}
                className="text-xs text-accent tracking-widest px-3 py-2.5 hover:underline disabled:opacity-40">ADD</button>
              <button onClick={() => { setAddingNew(false); setNewName('') }}
                className="text-xs text-muted tracking-widest px-2 py-2.5 hover:text-white transition-colors">✕</button>
            </div>
          ) : (
            <PlayerSelect
              value={addId}
              players={availablePlayers}
              onChange={val => val === '__new__' ? setAddingNew(true) : addExisting(val)}
            />
          )}
        </div>
      )}

      {/* settle */}
      {!settling ? (
        <button onClick={() => setSettling(true)} disabled={pending || session.participants.length === 0}
          className="w-full bg-white text-bg text-xs font-medium tracking-widest py-3 hover:bg-accent transition-colors disabled:opacity-40">
          SETTLE SESSION
        </button>
      ) : (
        <div className="border border-border p-4">
          <p className="text-xs text-muted tracking-widest mb-1">FINAL CHIPS</p>
          <p className="text-xs text-muted mb-4">Enter final chips for active players. Cashed-out players are already locked.</p>
          <div className="flex flex-col gap-2 mb-4">
            {session.participants.map(p => (
              <div key={p.player_id} className="flex items-center gap-3">
                <span className="flex-1 flex items-baseline gap-2 min-w-0">
                  <span className="text-white text-sm truncate">{p.name}</span>
                  {p.settled_at !== null && (
                    <span className="shrink-0 text-[10px] text-muted tracking-widest">CASHED OUT</span>
                  )}
                </span>
                <span className="text-xs text-muted">buy-in {p.total_buyin.toLocaleString()}</span>
                {p.settled_at !== null ? (
                  <div className="w-28 border border-transparent px-3 py-2 text-right">
                    <span className="text-sm text-white tabular-nums">{(p.final_chips ?? 0).toLocaleString()}</span>
                  </div>
                ) : (
                  <input type="number" inputMode="numeric" min="0" value={finals[p.player_id] ?? ''}
                    onChange={e => setFinals(f => ({ ...f, [p.player_id]: e.target.value }))}
                    placeholder="final"
                    className="w-28 bg-surface border border-border text-white text-sm px-3 py-2 outline-none focus:border-white transition-colors placeholder:text-muted text-right" />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs tracking-widest border-t border-border pt-3 mb-4">
            <span className="text-muted">Σ FINAL / POT</span>
            <span className={settleDiff === 0 ? 'text-accent' : 'text-amber-400'}>
              {totalFinal.toLocaleString()} / {pot.toLocaleString()}
              {settleDiff !== 0 && (
                <span className="ml-2">diff {settleDiff > 0 ? '+' : ''}{settleDiff.toLocaleString()}
                  {settleDiff % unit === 0 && ` (= ${settleDiff / unit}×${unit})`}
                </span>
              )}
            </span>
          </div>

          {settleError && (
            <div className="mb-4 text-xs text-amber-400">
              Not balanced — diff {settleError.diff > 0 ? '+' : ''}{settleError.diff.toLocaleString()}.
              Double-check everyone&apos;s final chips; if correct, you can force settle (this session will keep an unbalanced record).
              <button onClick={() => submitSettle(true)} disabled={pending}
                className="block mt-2 text-danger tracking-widest hover:underline disabled:opacity-40">
                FORCE SETTLE →
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => submitSettle(false)} disabled={pending || !allFinalsFilled}
              className="flex-1 bg-white text-bg text-xs font-medium tracking-widest py-3 hover:bg-accent transition-colors disabled:opacity-40">
              {pending ? 'SETTLING...' : 'CONFIRM SETTLE'}
            </button>
            <button onClick={() => { setSettling(false); setSettleError(null) }} disabled={pending}
              className="text-xs text-muted tracking-widest px-4 hover:text-white transition-colors disabled:opacity-40">
              CANCEL
            </button>
          </div>
        </div>
      )}
    </>
  )
}
