'use client'

import { useTransition, type ComponentProps } from 'react'
import { useRouter } from 'next/navigation'
import PlayerSessionHistoryTable from '@/components/PlayerSessionHistoryTable'
import SessionPagination from '@/components/SessionPagination'

type Props = Pick<ComponentProps<typeof PlayerSessionHistoryTable>, 'groupId' | 'rows'> &
  Omit<ComponentProps<typeof SessionPagination>, 'onPageChange'>

export default function PlayerSessionHistory({ groupId, rows, ...pagination }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return <section aria-label="Session history" aria-busy={isPending}>
    <div role={isPending ? 'status' : undefined} aria-label={isPending ? 'Loading session history' : undefined}>
      <div aria-hidden={isPending || undefined}>
        <PlayerSessionHistoryTable groupId={groupId} rows={rows} loading={isPending} />
      </div>
    </div>
    <div inert={isPending} className={isPending ? 'opacity-50' : undefined}>
      <SessionPagination {...pagination} onPageChange={href => {
        if (isPending) return
        startTransition(() => router.push(href, { scroll: false }))
      }} />
    </div>
  </section>
}
