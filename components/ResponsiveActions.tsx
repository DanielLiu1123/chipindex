'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import styles from './ResponsiveActions.module.css'

/** Choose the largest fitting scale without hiding labels or shrinking below the CSS minimum. */
function fitActions(row: HTMLDivElement) {
  if (!row.clientWidth) return
  const children = Array.from(row.children)
  const availableWidth = row.clientWidth
  function fits(scale: number) {
    row.style.setProperty('--action-scale', String(scale))
    const contentWidth = children.reduce((sum, child) => sum + child.getBoundingClientRect().width, 0)
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0
    return contentWidth + gap * Math.max(0, children.length - 1) <= availableWidth
  }
  if (fits(1)) return
  let low = 0
  let high = 1
  // Eight iterations resolve the scale to 1/256, below a pixel of spacing.
  for (let i = 0; i < 8; i++) {
    const middle = (low + high) / 2
    if (fits(middle)) low = middle
    else high = middle
  }
  row.style.setProperty('--action-scale', String(low))
}

export default function ResponsiveActions({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = ref.current
    if (!row) return
    let active = true
    let frame = 0
    let observedWidth = row.clientWidth
    const scheduleFit = () => {
      if (!active || frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        fitActions(row)
      })
    }
    const resize = new ResizeObserver(() => {
      if (row.clientWidth === observedWidth) return
      observedWidth = row.clientWidth
      scheduleFit()
    })
    resize.observe(row)
    const mutation = new MutationObserver(scheduleFit)
    mutation.observe(row, { childList: true, subtree: true, characterData: true })
    void document.fonts?.ready.then(scheduleFit)
    document.fonts?.addEventListener('loadingdone', scheduleFit)
    fitActions(row)
    return () => {
      active = false
      cancelAnimationFrame(frame)
      resize.disconnect()
      mutation.disconnect()
      document.fonts?.removeEventListener('loadingdone', scheduleFit)
    }
  }, [])
  return <div ref={ref} className={cn(styles.row, className)}>{children}</div>
}
