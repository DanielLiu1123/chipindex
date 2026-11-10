'use client'

import { useTransition, type ComponentProps, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import SessionPagination from '@/components/SessionPagination'

import { TableLoadingContext } from '@/components/ResponsiveTable'

export default function PaginatedSessions({ children, ...pagination }:
  Omit<ComponentProps<typeof SessionPagination>, 'onPageChange'> & { children: ReactNode }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return <section aria-label="Sessions" aria-busy={pending}>
    <div role={pending ? 'status' : undefined} aria-label={pending ? 'Loading sessions' : undefined}>
      <div aria-hidden={pending || undefined} inert={pending}>
        <TableLoadingContext.Provider value={pending}>{children}</TableLoadingContext.Provider>
      </div>
    </div>
    <div inert={pending} className={pending ? 'opacity-50' : undefined}>
      <SessionPagination {...pagination} onPageChange={href => {
        if (!pending) startTransition(() => router.push(href, { scroll: false }))
      }} />
    </div>
  </section>
}
