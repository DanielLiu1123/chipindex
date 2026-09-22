'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { Button } from '@/components/ui/button'

import { useState } from 'react'
import Link from 'next/link'
import ConfirmModal from '@/components/ConfirmModal'
import CashOutModal from '@/components/CashOutModal'
import BuyInModal from '@/components/BuyInModal'
import BuyInNotice from '@/components/BuyInNotice'
import PlayerActionButton from '@/components/PlayerActionButton'
import LiveParticipantList from '@/components/LiveParticipantList'
import LiveSettlementPanel from '@/components/LiveSettlementPanel'
import type { Player } from '@/lib/domain-types'
import type { LiveSessionData } from '@/lib/domain-types'
import { summarizeLiveSession } from '@/lib/live-session'
import { usePlayerDirectory } from '@/lib/use-player-directory'
import { useLiveSession } from '@/lib/use-live-session'

export default function LiveSession({
  groupId,
  session,
  allPlayers,
}: {
  groupId: string
  session: LiveSessionData
  allPlayers: Player[]
}) {
  const flow = useLiveSession(groupId, session)
  const { panel, finals, pending, error } = flow
  const settling = panel.kind === 'settle'
  const confirmRemove = panel.kind === 'remove' ? panel.participant : null
  const cashOut = panel.kind === 'cash-out' ? panel.participant : null
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const unit = session.buy_in_unit
  const { pot, cashedOutTotal } = summarizeLiveSession(
    session.participants,
    finals,
  )
  const directory = usePlayerDirectory({
    groupId,
    players: allPlayers,
    excludedIds: session.participants.map((player) => player.player_id),
    excludedMessage: 'This player is already in the session.',
    onCreated: flow.refresh,
  })

  function toggleExpand(player_id: string) {
    setExpanded((s) => {
      const next = new Set(s)
      if (next.has(player_id)) next.delete(player_id)
      else next.add(player_id)
      return next
    })
  }

  return (
    <>
      <BuyInNotice
        command={flow.receipt}
        participants={session.participants}
        onDismiss={flow.dismissReceipt}
      />
      <BuyInModal
        open={panel.kind === 'buy-in'}
        groupId={groupId}
        sessionId={session.id}
        participants={session.participants}
        unit={unit}
        onClose={flow.close}
        onSaved={flow.buyInSaved}
      />
      <BuyInModal
        open={panel.kind === 'add-players'}
        groupId={groupId}
        sessionId={session.id}
        mode="join"
        participants={directory.participants}
        unit={unit}
        onClose={flow.close}
        onSaved={flow.refresh}
        onCreatePlayer={directory.create}
      />
      <ConfirmModal
        open={confirmRemove !== null}
        title={confirmRemove ? `Remove ${confirmRemove.name}?` : ''}
        description={
          confirmRemove
            ? `This will delete ${confirmRemove.settled_at !== null ? `their ${confirmRemove.final_chips?.toLocaleString() ?? 0}-chip cash-out result and ` : ''}${confirmRemove.buy_ins.length} buy-in(s) (${confirmRemove.total_buyin.toLocaleString()} chips).`
            : undefined
        }
        confirmLabel="REMOVE"
        onConfirm={flow.confirmRemove}
        onCancel={flow.close}
      />
      <CashOutModal
        participant={cashOut}
        pending={pending}
        error={error}
        onConfirm={flow.confirmCashOut}
        onCancel={flow.close}
      />
      <div className="mb-6">
        <Link
          href={`/groups/${groupId}/sessions`}
          className="text-muted-foreground text-xs hover:text-foreground tracking-normal"
        >
          ← SESSIONS
        </Link>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span className="inline-block w-2 h-2 rounded-full bg-live motion-safe:animate-pulse" />
        <span className="text-xs text-live tracking-normal">LIVE</span>
        <span className="text-foreground">{session.date}</span>
        {session.description && (
          <span className="text-sm text-muted-foreground">
            · {session.description}
          </span>
        )}
      </div>
      <div className="mb-6 flex items-baseline gap-2">
        <span className="text-xs text-muted-foreground tracking-normal">
          TOTAL BUY-IN
        </span>
        <span className="text-primary text-lg">{pot.toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">chips</span>
      </div>
      {cashedOutTotal > 0 && (
        <div className="-mt-5 mb-6 flex items-baseline gap-2">
          <span className="text-xs text-muted-foreground tracking-normal">
            CASHED OUT
          </span>
          <span className="text-foreground text-sm">
            {cashedOutTotal.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">chips</span>
        </div>
      )}

      {error && panel.kind !== 'cash-out' && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!settling && (
        <div className="mb-5 grid grid-cols-2 gap-2">
          <PlayerActionButton
            action="add-player"
            onClick={flow.openAddPlayers}
            disabled={pending}
          />
          <PlayerActionButton
            action="buy-in"
            onClick={flow.openBuyIn}
            disabled={
              pending ||
              !session.participants.some((p) => p.settled_at === null)
            }
          />
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
            onRevokeBuyIn={(buyInId) => {
              void flow.revokeBuyIn(buyInId)
            }}
            onCashOut={flow.openCashOut}
            onUndoCashOut={(playerId) => {
              void flow.undoCashOut(playerId)
            }}
            onRemove={flow.openRemove}
          />
        </div>
      )}

      {/* settle */}
      {!settling ? (
        <Button
          variant="default"
          type="button"
          onClick={flow.openSettlement}
          disabled={pending || session.participants.length === 0}
          className="w-full"
        >
          SETTLE SESSION
        </Button>
      ) : (
        <LiveSettlementPanel
          participants={session.participants}
          finals={finals}
          pending={pending}
          settleError={
            panel.kind === 'settle' && panel.difference !== null
              ? { diff: panel.difference }
              : null
          }
          onFinalChange={flow.changeFinal}
          onSubmit={(force) => {
            void flow.confirmSettlement(force)
          }}
          onCancel={flow.close}
        />
      )}
    </>
  )
}
