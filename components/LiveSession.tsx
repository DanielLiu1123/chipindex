'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PlayerSelect from '@/components/PlayerSelect'
import ConfirmModal from '@/components/ConfirmModal'
import CashOutModal from '@/components/CashOutModal'
import LiveParticipantList from '@/components/LiveParticipantList'
import LiveSettlementPanel from '@/components/LiveSettlementPanel'
import type { Player } from '@/lib/domain-types'
import type { LiveSessionData, LiveParticipant } from '@/lib/queries'
import { activeFinalEntries, summarizeLiveSession } from '@/lib/live-session'
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
  const { pot, cashedOutTotal } = summarizeLiveSession(session.participants, finals)
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

  async function submitSettle(force: boolean) {
    setPending(true)
    setError('')
    setSettleError(null)
    try {
      await settleSession(groupId, session.id, {
        finals: activeFinalEntries(session.participants, finals),
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
        <LiveParticipantList
          participants={session.participants}
          expanded={expanded}
          customAmounts={custom}
          buyInUnit={unit}
          pending={pending}
          interactive={!settling}
          onToggle={toggleExpand}
          onCustomAmountChange={(playerId, value) => setCustom(current => ({ ...current, [playerId]: value }))}
          onAddBuyIn={(playerId, amount) => {
            setCustom(current => ({ ...current, [playerId]: '' }))
            void addBuyIn(playerId, amount)
          }}
          onRevokeBuyIn={buyInId => { void undoBuyIn(buyInId) }}
          onCashOut={participant => { setCashOutError(''); setCashOut(participant) }}
          onUndoCashOut={playerId => { void undoCashOut(playerId) }}
          onRemove={setConfirmRemove}
        />
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
        <LiveSettlementPanel
          participants={session.participants}
          finals={finals}
          buyInUnit={unit}
          pending={pending}
          settleError={settleError}
          onFinalChange={(playerId, value) => setFinals(current => ({ ...current, [playerId]: value }))}
          onSubmit={force => { void submitSettle(force) }}
          onCancel={() => { setSettling(false); setSettleError(null) }}
        />
      )}
    </>
  )
}
