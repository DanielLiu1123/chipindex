'use client'

import headerStyles from './ResponsiveActions.module.css'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const Icon = state === 'copied' ? Check : Copy
  return <Button
    variant={state === 'error' ? 'destructive' : 'secondary'}
    className={cn(
      headerStyles.action,
      'h-9 gap-2 rounded-[8px] border-border px-3 text-xs',
      state === 'copied' && 'border-profit/20 bg-profit/10 text-profit hover:bg-profit/15',
      state === 'error' && 'border-destructive/20',
    )}
    aria-label={label}
    title={label}
    type="button"
    onClick={copySummary}
  >
    <Icon aria-hidden="true" className="size-3.5" strokeWidth={1.6} />
    <span className={headerStyles.label} aria-live="polite">{label}</span>
  </Button>
}
