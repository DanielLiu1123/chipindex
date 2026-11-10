'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import styles from './ResponsiveActions.module.css'

/** Keep action labels intact; compact spacing and typography only when needed. */
export default function ResponsiveActions({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = ref.current
    if (!row) return
    let active = true
    function fit() {
      if (!active || !row || !row.clientWidth) return
      const element = row
      function fits(scale: number) {
        element.style.setProperty('--action-scale', String(scale))
        const width = Array.from(element.children).reduce((sum, child) => sum + child.getBoundingClientRect().width, 0)
        return width + parseFloat(getComputedStyle(element).columnGap) <= element.clientWidth
      }
      if (fits(1)) return
      let low = 0
      let high = 1
      for (let i = 0; i < 8; i++) {
        const middle = (low + high) / 2
        if (fits(middle)) low = middle
        else high = middle
      }
      row.style.setProperty('--action-scale', String(low))
    }
    let frame = 0
    let observedWidth = row.clientWidth
    const resize = new ResizeObserver(() => {
      if (row.clientWidth === observedWidth) return
      observedWidth = row.clientWidth
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(fit)
    })
    resize.observe(row)
    const mutation = new MutationObserver(fit)
    mutation.observe(row, { childList: true, subtree: true, characterData: true })
    void document.fonts?.ready.then(fit)
    document.fonts?.addEventListener('loadingdone', fit)
    fit()
    return () => { active = false; cancelAnimationFrame(frame); resize.disconnect(); mutation.disconnect(); document.fonts?.removeEventListener('loadingdone', fit) }
  }, [])
  return <div className={className}><div ref={ref} className={styles.row}>{children}</div></div>
}
