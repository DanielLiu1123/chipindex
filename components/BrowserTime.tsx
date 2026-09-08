'use client'
import { localDateTime, localTime } from '@/lib/browser-time'
import { useBrowserReady } from '@/lib/use-browser-ready'
export default function BrowserTime({ value, includeDate = false }: { value: string; includeDate?: boolean }) {
  const ready = useBrowserReady()
  return <time dateTime={value}>{ready ? (includeDate ? localDateTime(value) : localTime(value)) : '—'}</time>
}
