'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ApiClientError,
  cashOutSessionParticipant,
  removeSessionParticipant,
  revokeBuyIn,
  settleSession,
  undoSessionParticipantCashOut,
} from './client'
import { errorMessage } from './error-message'
import { activeFinalEntries } from './live-session'
import type { LiveParticipant, LiveSessionData } from './domain-types'
import type { BatchBuyInCommand } from './contracts'

type Panel =
  | { kind: 'none' | 'buy-in' | 'add-players' }
  | { kind: 'remove' | 'cash-out'; participant: LiveParticipant }
  | { kind: 'settle'; difference: number | null }

// One owner for session commands, their pending lifetime and refresh behavior.
// Buy-in request IDs/retries remain owned by usePlayerAction inside its dialog.
export function useLiveSession(groupId: string, session: LiveSessionData) {
  const router = useRouter()
  const [panel, setPanel] = useState<Panel>({ kind: 'none' })
  const [finals, setFinals] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)
  const busy = useRef(false)
  const [refreshing, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [receipt, setReceipt] = useState<BatchBuyInCommand | null>(null)

  function open(next: Panel) {
    if (busy.current || refreshing) return
    setError('')
    setPanel(next)
  }
  function close() {
    open({ kind: 'none' })
  }

  async function run(
    command: () => Promise<unknown>,
    success: () => void,
    failure = (reason: unknown) => setError(errorMessage(reason)),
  ) {
    if (busy.current || refreshing) return
    busy.current = true
    setPending(true)
    setError('')
    try {
      await command()
      success()
    } catch (reason) {
      failure(reason)
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  const refresh = () => startTransition(() => router.refresh())
  function finish() {
    setPanel({ kind: 'none' })
    refresh()
  }

  function confirmCashOut(finalChips: number) {
    if (panel.kind !== 'cash-out') return
    return run(
      () =>
        cashOutSessionParticipant(groupId, session.id, {
          player_id: panel.participant.player_id,
          final_chips: finalChips,
        }),
      finish,
    )
  }
  function confirmRemove() {
    if (panel.kind !== 'remove') return
    // Confirmation owns its displayed failure, but this module still locks all commands.
    return run(
      () =>
        removeSessionParticipant(
          groupId,
          session.id,
          panel.participant.player_id,
        ),
      finish,
      (reason) => {
        throw reason
      },
    )
  }
  function confirmSettlement(force: boolean) {
    if (panel.kind !== 'settle') return
    const entries = activeFinalEntries(session.participants, finals)
    setPanel({ ...panel, difference: null })
    return run(
      () => settleSession(groupId, session.id, { finals: entries, force }),
      () => {
        setPanel({ kind: 'none' })
        router.push(`/groups/${groupId}/sessions/${session.id}`)
        refresh()
      },
      (reason) => {
        if (
          reason instanceof ApiClientError &&
          reason.payload.code === 'unbalanced' &&
          typeof reason.payload.diff === 'number'
        ) {
          const difference = reason.payload.diff
          setPanel((current) =>
            current.kind === 'settle' ? { ...current, difference } : current,
          )
        } else setError(errorMessage(reason))
      },
    )
  }
  return {
    panel,
    finals,
    pending: pending || refreshing,
    error,
    receipt,
    close,
    refresh,
    openBuyIn: () => open({ kind: 'buy-in' }),
    openAddPlayers: () => open({ kind: 'add-players' }),
    openCashOut: (participant: LiveParticipant) =>
      open({ kind: 'cash-out', participant }),
    openRemove: (participant: LiveParticipant) =>
      open({ kind: 'remove', participant }),
    openSettlement: () => open({ kind: 'settle', difference: null }),
    changeFinal: (playerId: string, value: string) => {
      if (busy.current || refreshing || panel.kind !== 'settle') return
      setFinals((current) => ({ ...current, [playerId]: value }))
      setPanel({ kind: 'settle', difference: null })
    },
    confirmCashOut,
    confirmRemove,
    confirmSettlement,
    revokeBuyIn: (id: string) =>
      run(() => revokeBuyIn(groupId, session.id, id), refresh),
    undoCashOut: (id: string) =>
      run(
        () => undoSessionParticipantCashOut(groupId, session.id, id),
        refresh,
      ),
    buyInSaved: (command: BatchBuyInCommand) => {
      setReceipt(command)
      refresh()
    },
    dismissReceipt: () => setReceipt(null),
  }
}
