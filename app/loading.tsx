import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return <div className="space-y-4" role="status" aria-label="Loading">
    <Skeleton className="h-8 w-40" />
    {Array.from({ length: 6 }, (_, i) => <div key={i} className="flex justify-between border-b py-4">
      <Skeleton className="h-4 w-28" /><Skeleton className="h-4 w-16" />
    </div>)}
  </div>
}
