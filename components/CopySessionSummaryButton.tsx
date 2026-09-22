'use client'

import { Button } from '@/components/ui/button'

import { useEffect, useRef, useState } from 'react'
import { buildSessionSummary, type SessionSummaryData } from '@/lib/session-summary'

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
  try {
    textarea.select()
    if (!document.execCommand('copy')) throw new Error('Clipboard unavailable')
  } finally {
    textarea.remove()
  }
}

export default function CopySessionSummaryButton({ summary }: { summary: SessionSummaryData }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')
  const resetTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
  }, [])

  function clearResetTimer() {
    if (resetTimer.current === null) return
    window.clearTimeout(resetTimer.current)
    resetTimer.current = null
  }

  async function copySummary() {
    clearResetTimer()
    try {
      await writeClipboard(buildSessionSummary(summary, {
        detailUrl: `${window.location.origin}${window.location.pathname}`,
      }))
      setState('copied')
      resetTimer.current = window.setTimeout(() => {
        setState('idle')
        resetTimer.current = null
      }, 1800)
    } catch {
      setState('error')
    }
  }

  const label = state === 'copied' ? 'COPIED' : state === 'error' ? 'COPY FAILED' : 'COPY SUMMARY'
  return <Button variant={state === 'error' ? 'destructive' : 'outline'} type="button" onClick={copySummary}
    >
    {label}
  </Button>
}
