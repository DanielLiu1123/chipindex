import { TableSkeleton } from '@/components/PageSkeleton'

export default function Loading() {
  return <TableSkeleton label="Loading sessions" columns={6} />
}
