'use client'

import { useLinkStatus } from 'next/link'

export default function NavigationHint() {
  const { pending } = useLinkStatus()
  return <span role="status" className="pointer-events-none absolute inset-x-0 -bottom-1">
    {pending && <>
      <span className="sr-only">Loading</span>
      <span aria-hidden="true" className="block h-0.5 rounded-full bg-primary motion-safe:animate-pulse" />
    </>}
  </span>
}
