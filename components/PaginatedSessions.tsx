'use client'

import { useTransition, type ComponentProps, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import SessionPagination from '@/components/SessionPagination'

import { TableLoadingContext } from '@/components/ResponsiveTable'

export default function PaginatedSessions({ children, label = 'Sessions', loadingLabel = 'Loading sessions', ...pagination }:
  Omit<ComponentProps<typeof SessionPagination>, 'onPageChange'> & { children: ReactNode | ((loading: boolean) => ReactNode); label?: string; loadingLabel?: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return <section aria-label={label} aria-busy={pending}>
    <div role={pending ? 'status' : undefined} aria-label={pending ? loadingLabel : undefined}>
      <div aria-hidden={pending || undefined} inert={pending}>
        {typeof children === 'function' ? children(pending) : <TableLoadingContext.Provider value={pending}>{children}</TableLoadingContext.Provider>}
      </div>
    </div>
    <div inert={pending} className={pending ? 'opacity-50' : undefined}>
      <SessionPagination {...pagination} onPageChange={href => {
        if (!pending) startTransition(() => router.push(href, { scroll: false }))
      }} />
    </div>
  </section>
}
