'use client'
import { useSyncExternalStore } from 'react'
const subscribe = () => () => {}
// The server and initial hydration render agree; local-zone formatting starts
// only in the browser, never using the server's timezone as a substitute.
export function useBrowserReady(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false)
}
