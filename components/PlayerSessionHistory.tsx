'use client'

import { useTransition, type ComponentProps } from 'react'
import { useRouter } from 'next/navigation'
import PlayerSessionHistoryTable from '@/components/PlayerSessionHistoryTable'
import SessionPagination from '@/components/SessionPagination'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'

type Props = ComponentProps<typeof PlayerSessionHistoryTable> &
  Omit<ComponentProps<typeof SessionPagination>, 'onPageChange'>

function HistorySkeleton({ rowCount }: { rowCount: number }) {
  return <div role="status" aria-label="Loading session history">
    <div aria-hidden="true">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: 5 }, (_, column) => <TableHead key={column} className="py-3 px-1 first:pl-3 last:pr-3 sm:first:pl-4 sm:last:pr-4">
              <Skeleton className={`h-4 w-16 ${column === 0 ? '' : 'ml-auto'}`} />
            </TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rowCount }, (_, row) => <TableRow key={row}>
            {Array.from({ length: 5 }, (_, column) => <TableCell key={column} className="py-4 px-1 first:pl-3 last:pr-3 sm:first:pl-4 sm:last:pr-4">
              <Skeleton className={`h-5 ${column === 0 ? 'w-24' : 'ml-auto w-16'}`} />
            </TableCell>)}
          </TableRow>)}
        </TableBody>
      </Table>
    </div>
    <span className="sr-only">Loading session history…</span>
  </div>
}

export default function PlayerSessionHistory({ groupId, rows, ...pagination }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return <section aria-label="Session history" aria-busy={isPending}>
    {isPending
      ? <HistorySkeleton rowCount={Math.max(1, rows.length)} />
      : <PlayerSessionHistoryTable groupId={groupId} rows={rows} />}
    <div inert={isPending} className={isPending ? 'opacity-50' : undefined}>
      <SessionPagination {...pagination} onPageChange={href => {
        if (isPending) return
        startTransition(() => router.push(href, { scroll: false }))
      }} />
    </div>
  </section>
}
