'use client'

import { useRef, useState } from 'react'
import { ApiClientError } from './client'
import { MAX_BATCH_PLAYERS, parseBuyInAmount } from './buy-in-policy'
import type { BatchBuyInCommand } from './contracts'
import type { SelectablePlayer } from './player-selection'

export type PlayerAction =
  | { kind: 'players'; submit: (ids: string[]) => Promise<void> }
  | { kind: 'draft'; unit: number; submit: (ids: string[], amount: number) => void }
  | { kind: 'buy-in'; unit: number; record: (command: BatchBuyInCommand) => Promise<unknown>; onSaved: (command: BatchBuyInCommand) => void }

// Owns amount validation and submission lifetime. Failed network responses
// retain request IDs, including when server props refresh.
export function usePlayerAction(action: PlayerAction, chosen: SelectablePlayer[]) {
  const initialValue = action.kind === 'players' ? '' : String(action.unit)
  const [value, setValue] = useState(initialValue)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState<BatchBuyInCommand | null>(null)
  const busy = useRef(false)
  const amount = parseBuyInAmount(value)
  const valid = chosen.length > 0 && chosen.length <= MAX_BATCH_PLAYERS
    && (action.kind === 'players' || amount !== null)

  function reset() {
    if (attempt) return false
    setValue(initialValue); setError('')
    return true
  }

  async function submit(): Promise<boolean> {
    if (busy.current || (!attempt && !valid)) return false
    busy.current = true; setPending(true); setError('')
    try {
      const ids = chosen.map(player => player.player_id)
      if (action.kind === 'players') {
        await action.submit(ids)
      } else if (action.kind === 'draft') {
        if (amount === null) return false
        action.submit(ids, amount)
      } else {
        let request = attempt
        if (!request) {
          if (amount === null) return false
          request = { amount, entries: ids.map(player_id => ({ id: crypto.randomUUID(), player_id })) }
        }
        setAttempt(request)
        await action.record(request)
        action.onSaved(request)
      }
      setAttempt(null)
      setValue(initialValue)
      return true
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

  return { value, setValue, amount, valid, pending, error,
    retrying: attempt !== null, locked: pending || attempt !== null,
    isBusy: () => busy.current, reset, submit }
}
