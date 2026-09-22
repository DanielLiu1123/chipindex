import { TableSkeleton } from '@/components/PageSkeleton'

export default function Loading() {
  return <TableSkeleton label="Loading leaderboard" columns={7} leaderboard />
}
