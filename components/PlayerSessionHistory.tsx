'use client'

import { useTransition, type ComponentProps } from 'react'
import { useRouter } from 'next/navigation'
import PlayerSessionHistoryTable from '@/components/PlayerSessionHistoryTable'
import SessionPagination from '@/components/SessionPagination'

type Props = ComponentProps<typeof PlayerSessionHistoryTable> &
  Omit<ComponentProps<typeof SessionPagination>, 'onPageChange'>

export default function PlayerSessionHistory({ groupId, rows, ...pagination }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return <section aria-label="Session history" aria-busy={isPending}>
    <PlayerSessionHistoryTable groupId={groupId} rows={rows} />
    <div role="status" className="mt-2 h-4 text-xs text-muted-foreground">
      {isPending ? 'Loading session history…' : null}
    </div>
    <div inert={isPending} className={isPending ? 'opacity-50' : undefined}>
      <SessionPagination {...pagination} onPageChange={href => {
        if (isPending) return
        startTransition(() => router.push(href, { scroll: false }))
      }} />
    </div>
  </section>
}
