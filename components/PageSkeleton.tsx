import { Skeleton } from '@/components/ui/skeleton'

export function TableSkeleton({ label, columns, leaderboard = false }: {
  label: string
  columns: number
  leaderboard?: boolean
}) {
  return <div role="status" aria-label={label} className="space-y-6">
    <div aria-hidden="true" className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-36" /><Skeleton className="h-8 w-32" />
      </div>
      {leaderboard && <>
        <Skeleton className="h-8 w-28" />
        <div className="flex items-center gap-2"><Skeleton className="h-5 w-8" /><Skeleton className="h-4 w-40" /></div>
      </>}
      <div>
        {Array.from({ length: 7 }, (_, row) => <div key={row} className="grid gap-3 border-b py-5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }, (_, column) => <Skeleton key={column} className={row === 0 ? 'h-3 w-3/4' : 'h-4 w-full'} />)}
        </div>)}
      </div>
    </div>
    <span className="sr-only">{label}</span>
  </div>
}

export function SettingsSkeleton() {
  return <div role="status" aria-label="Loading settings" className="space-y-8">
    <div aria-hidden="true" className="space-y-8">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-9 w-full max-w-sm" />
      <div className="flex justify-between"><Skeleton className="h-5 w-28" /><Skeleton className="h-8 w-24" /></div>
      {Array.from({ length: 5 }, (_, i) => <div key={i} className="flex justify-between border-b pb-4"><Skeleton className="h-5 w-32" /><Skeleton className="h-8 w-16" /></div>)}
    </div>
    <span className="sr-only">Loading settings</span>
  </div>
}

export function PlayerSkeleton() {
  return <div role="status" aria-label="Loading player profile" className="space-y-6">
    <div aria-hidden="true" className="space-y-6">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-40" />
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14" />)}
      </div>
      <Skeleton className="h-64 w-full" />
      {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
    <span className="sr-only">Loading player profile</span>
  </div>
}

export function SessionFormSkeleton() {
  return <div role="status" aria-label="Loading session form" className="space-y-6">
    <div aria-hidden="true" className="space-y-6">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-5 w-36" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-9 w-full" /></div>)}
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-9 w-28" />
    </div>
    <span className="sr-only">Loading session form</span>
  </div>
}
