'use client'

import { useState } from 'react'
import type { SessionDetail } from '@/lib/queries'
import { buildSessionSummary } from '@/lib/session-summary'

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('Clipboard unavailable')
}

export default function CopySessionSummaryButton({ groupName, session }: {
  groupName: string
  session: SessionDetail
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')

  async function copySummary() {
    try {
      await writeClipboard(buildSessionSummary({
        group_name: groupName,
        date: session.date,
        description: session.description,
        exchange_rate: session.exchange_rate,
        detail_url: `${window.location.origin}${window.location.pathname}`,
        started_at: session.started_at,
        ended_at: session.ended_at,
        participants: session.session_entries.map(entry => ({
          player_id: entry.player_id,
          name: entry.players?.name ?? entry.player_id,
          final_chips: entry.final_chips,
          settled_at: entry.settled_at,
          buy_ins: entry.buy_ins,
        })),
      }))
      setState('copied')
      window.setTimeout(() => setState('idle'), 1800)
    } catch {
      setState('error')
    }
  }

  const label = state === 'copied' ? 'COPIED' : state === 'error' ? 'COPY FAILED' : 'COPY SUMMARY'
  const stateClasses = state === 'error'
    ? 'text-danger border-danger/50'
    : state === 'copied'
      ? 'text-accent border-accent/50 bg-accent/5'
      : 'text-sky-400 border-sky-400/50 hover:border-sky-400 hover:bg-sky-400/10'
  return <button type="button" onClick={copySummary}
    className={`text-xs tracking-widest border px-2.5 py-1 transition-colors ${stateClasses}`}>
    {label}
  </button>
}
