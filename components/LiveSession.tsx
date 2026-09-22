'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { Button } from '@/components/ui/button'

import { errorMessage } from '@/lib/error-message'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'
import CashOutModal from '@/components/CashOutModal'
import BuyInModal from '@/components/BuyInModal'
import BuyInNotice from '@/components/BuyInNotice'
import PlayerActionButton from '@/components/PlayerActionButton'
import LiveParticipantList from '@/components/LiveParticipantList'
import LiveSettlementPanel from '@/components/LiveSettlementPanel'
import type { BatchBuyInCommand } from '@/lib/contracts'
import type { Player } from '@/lib/domain-types'
import type { LiveSessionData, LiveParticipant } from '@/lib/domain-types'
import { activeFinalEntries, summarizeLiveSession } from '@/lib/live-session'
import { usePlayerDirectory } from '@/lib/use-player-directory'
import {
  ApiClientError,
  cashOutSessionParticipant,
  removeSessionParticipant,
  revokeBuyIn,
  settleSession,
  undoSessionParticipantCashOut,
} from '@/lib/client'

export default function LiveSession({ groupId, session, allPlayers }: { groupId: string; session: LiveSessionData; allPlayers: Player[] }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [buyInOpen, setBuyInOpen] = useState(false)
  const [addPlayersOpen, setAddPlayersOpen] = useState(false)
  const [settling, setSettling] = useState(false)
  const [finals, setFinals] = useState<Record<string, string>>({})
  const [settleError, setSettleError] = useState<{ diff: number } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<LiveParticipant | null>(null)
  const [cashOut, setCashOut] = useState<LiveParticipant | null>(null)
  const [cashOutError, setCashOutError] = useState('')
  const [error, setError] = useState('')
  const [buyInNotice, setBuyInNotice] = useState<BatchBuyInCommand | null>(null)

  const unit = session.buy_in_unit
  const { pot, cashedOutTotal } = summarizeLiveSession(session.participants, finals)
  const directory = usePlayerDirectory({ groupId, players: allPlayers,
    excludedIds: session.participants.map(player => player.player_id),
    excludedMessage: 'This player is already in the session.', onCreated: () => router.refresh() })

  // Runs a mutation against the API, refreshing the page data on success and
  // surfacing the error message on failure.
  async function act(fn: () => Promise<unknown>) {
    setPending(true)
    setError('')
    try {
      await fn()
      router.refresh()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  const undoBuyIn = (buyinId: string) =>
    act(() => revokeBuyIn(groupId, session.id, buyinId))

  async function doRemove() {
    if (!confirmRemove) return
    const pid = confirmRemove.player_id
    await removeSessionParticipant(groupId, session.id, pid)
    setConfirmRemove(null)
    router.refresh()
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
      setCashOutError(errorMessage(e))
    } finally {
      setPending(false)
    }
  }

  const undoCashOut = (playerId: string) =>
    act(() => undoSessionParticipantCashOut(groupId, session.id, playerId))

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
      if (e instanceof ApiClientError && e.payload.code === 'unbalanced' && typeof e.payload.diff === 'number') {
        setSettleError({ diff: Number(e.payload.diff) })
      } else {
        setError(errorMessage(e))
      }
      setPending(false)
    }
  }

  return (
    <>
      <BuyInNotice command={buyInNotice} participants={session.participants} onDismiss={() => setBuyInNotice(null)} />
      <BuyInModal open={buyInOpen} groupId={groupId} sessionId={session.id}
        participants={session.participants} unit={unit}
        onClose={() => setBuyInOpen(false)} onSaved={command => { setBuyInNotice(command); router.refresh() }} />
      <BuyInModal open={addPlayersOpen} groupId={groupId} sessionId={session.id} mode="join"
        participants={directory.participants}
        unit={unit} onClose={() => setAddPlayersOpen(false)} onSaved={() => router.refresh()}
        onCreatePlayer={directory.create} />
      <ConfirmModal
        open={confirmRemove !== null}
        title={confirmRemove ? `Remove ${confirmRemove.name}?` : ''}
        description={confirmRemove ? `This will delete ${confirmRemove.settled_at !== null ? `their ${confirmRemove.final_chips?.toLocaleString() ?? 0}-chip cash-out result and ` : ''}${confirmRemove.buy_ins.length} buy-in(s) (${confirmRemove.total_buyin.toLocaleString()} chips).` : undefined}
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
        <Link href={`/groups/${groupId}/sessions`} className="text-muted-foreground text-xs hover:text-foreground tracking-normal">← SESSIONS</Link>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
        <span className="text-xs text-primary tracking-normal">LIVE</span>
        <span className="text-foreground">{session.date}</span>
        {session.description && <span className="text-sm text-muted-foreground">· {session.description}</span>}
      </div>
      <div className="mb-6 flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground tracking-normal">TOTAL BUY-IN</span>
        <span className="text-primary text-lg">{pot.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">chips</span>
      </div>
      {cashedOutTotal > 0 && (
        <div className="-mt-5 mb-6 flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground tracking-normal">CASHED OUT</span>
          <span className="text-foreground text-sm">{cashedOutTotal.toLocaleString()}</span>
          <span className="text-xs text-muted-foreground">chips</span>
        </div>
      )}

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {!settling && (
        <div className="mb-5 grid grid-cols-2 gap-2">
          <PlayerActionButton action="add-player" onClick={() => setAddPlayersOpen(true)} disabled={pending} />
          <PlayerActionButton action="buy-in" onClick={() => setBuyInOpen(true)}
            disabled={pending || !session.participants.some(p => p.settled_at === null)} />
        </div>
      )}

      {/* participants + buy-ins */}
      {!settling && (
        <div className="flex flex-col gap-1 mb-6">
          <LiveParticipantList
            participants={session.participants}
            expanded={expanded}
            pending={pending}
            interactive
            onToggle={toggleExpand}
            onRevokeBuyIn={buyInId => { void undoBuyIn(buyInId) }}
            onCashOut={participant => { setCashOutError(''); setCashOut(participant) }}
            onUndoCashOut={playerId => { void undoCashOut(playerId) }}
            onRemove={setConfirmRemove}
          />
        </div>
      )}

      {/* settle */}
      {!settling ? (
        <Button variant="default" type="button" onClick={() => setSettling(true)} disabled={pending || session.participants.length === 0}
          className="w-full">
          SETTLE SESSION
        </Button>
      ) : (
        <LiveSettlementPanel
          participants={session.participants}
          finals={finals}
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
