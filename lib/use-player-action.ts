'use client'

import { useRef, useState } from 'react'
import { ApiClientError } from './client'
import { MAX_BATCH_PLAYERS, parseBuyInAmount } from './buy-in-policy'
import type { BatchBuyInCommand } from './contracts'
import type { SelectablePlayer } from './player-selection'

export type PlayerAction =
  | { kind: 'players'; submit: (ids: string[]) => Promise<void> }
  | { kind: 'draft'; unit: number; submit: (ids: string[], amount: number) => void }
  | { kind: 'buy-in'; unit: number; record: (command: BatchBuyInCommand) => Promise<unknown>; onSaved: () => void }

interface ReceiptRow { player_id: string; name: string; amount: number }
interface Attempt { command: BatchBuyInCommand; receipt: ReceiptRow[] }

// Owns amount validation and submission lifetime. Failed network responses
// retain IDs and receipt names, including when server props refresh.
export function usePlayerAction(action: PlayerAction, chosen: SelectablePlayer[]) {
  const initialValue = action.kind === 'players' ? '' : String(action.unit)
  const [value, setValue] = useState(initialValue)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [receipt, setReceipt] = useState<ReceiptRow[] | null>(null)
  const busy = useRef(false)
  const amount = parseBuyInAmount(value)
  const valid = chosen.length > 0 && chosen.length <= MAX_BATCH_PLAYERS
    && (action.kind === 'players' || amount !== null)

  function reset() {
    if (attempt && !receipt) return false
    setValue(initialValue); setError(''); setAttempt(null); setReceipt(null)
    return true
  }

  async function submit(): Promise<boolean> {
    if (busy.current || receipt || (!attempt && !valid)) return false
    busy.current = true; setPending(true); setError('')
    try {
      const ids = chosen.map(player => player.player_id)
      if (action.kind === 'players') {
        await action.submit(ids)
        return true
      }
      if (action.kind === 'draft') {
        if (amount === null) return false
        action.submit(ids, amount)
        return true
      }
      let request = attempt
      if (!request) {
        if (amount === null) return false
        request = {
          command: { amount, entries: ids.map(player_id => ({ id: crypto.randomUUID(), player_id })) },
          receipt: chosen.map(player => ({ player_id: player.player_id, name: player.name, amount })),
        }
      }
      setAttempt(request)
      await action.record(request.command)
      setReceipt(request.receipt)
      action.onSaved()
      return false
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save. Please retry.')
      // Auth, timeout and throttling errors can occur on a retry after the first
      // request committed. Only definitive command rejections release the IDs.
      if (reason instanceof ApiClientError && [400, 404, 409, 422].includes(reason.status)) setAttempt(null)
      return false
    } finally {
      busy.current = false; setPending(false)
    }
  }

  return { value, setValue, amount, valid, pending, error, receipt,
    retrying: attempt !== null, locked: pending || attempt !== null,
    isBusy: () => busy.current, reset, submit }
}
