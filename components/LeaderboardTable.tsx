import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import ChipValue from '@/components/ChipValue'
import { cn } from '@/lib/utils'
import { defaultLeaderboardSort, sortLeaderboard, type LeaderboardSort, type LeaderboardSortKey } from '@/lib/leaderboard'
import type { PlayerStats } from '@/lib/stats'
import {
  TableHead,
  Table,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table'
import { LEADERBOARD_RANK_WIDTH, leaderboardColumns, type LeaderboardColumn } from '@/lib/leaderboard-layout'
import { useLeaderboardLayout } from '@/lib/use-leaderboard-layout'

const labels: Record<LeaderboardSortKey, string> = {
  total_yuan: 'CNY',
  total_chips: 'CHIPS',
  sessions_played: 'SESSIONS',
  win_rate: 'WIN%',
  pog_count: 'POG',
}

export default function LeaderboardTable({ groupId, stats, sort, onSort }: {
  groupId: string
  stats: PlayerStats[]
  sort: LeaderboardSort
  onSort: (sort: LeaderboardSort) => void
}) {
  const sortedStats = useMemo(() => sortLeaderboard(stats, sort), [stats, sort])
  const { containerRef, layout } = useLeaderboardLayout(stats)

  useEffect(() => {
    if (layout && !layout.visible.includes(sort.key)) {
      onSort(defaultLeaderboardSort)
    }
  }, [layout, sort.key, onSort])

  function columnClass(key: LeaderboardColumn) {
    return layout && !layout.visible.includes(key) ? 'hidden' : ''
  }

  return (
    <div ref={containerRef}>
      <Table className="w-full table-fixed text-sm tabular-nums">
        <colgroup>
          <col style={{ width: LEADERBOARD_RANK_WIDTH }} />
          {(layout?.visible ?? leaderboardColumns).map(key => (
            <col key={key} style={{ width: layout?.widths[key] }} />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow className="border-b border-border text-muted-foreground text-xs tracking-normal">
            <TableHead className="text-left pl-5 pr-0 py-3 font-normal">
              #
            </TableHead>
            <TableHead data-column="player" className="text-left px-2 py-3 font-normal">
              PLAYER
            </TableHead>
            {leaderboardColumns.filter(key => key !== 'player').map(key => {
              const active = sort.key === key
              const descending = sort.direction === 'desc'
              return (
                <TableHead key={key} data-column={key} aria-sort={active ? (descending ? 'descending' : 'ascending') : undefined}
                  className={cn('px-2 py-3 font-normal text-right', columnClass(key), key === 'pog_count' && 'pr-5')}>
                  <Button variant="ghost" className="px-0 text-xs" type="button"
                    onClick={() => onSort({ key, direction: active && descending ? 'asc' : 'desc' })}>
                    {labels[key]}{active && (descending ? ' ↓' : ' ↑')}
                  </Button>
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {stats.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={1 + (layout?.visible.length ?? leaderboardColumns.length)}
                className="py-12 text-center text-xs text-muted-foreground tracking-normal"
              >
                NO PLAYERS YET
              </TableCell>
            </TableRow>
          )}
          {sortedStats.map((s, i) => (
            <TableRow
              key={s.player.id}
              className="border-b border-border hover:bg-muted transition-colors"
            >
              <TableCell className="px-0.5 py-4 text-right text-muted-foreground text-xs">
                <Link
                  href={`/groups/${groupId}/players/${s.player.id}`}
                  className="block"
                >
                  {i + 1}
                </Link>
              </TableCell>
              <TableCell data-column="player" className="px-2 py-4 text-left whitespace-normal [overflow-wrap:anywhere]">
                <Link
                  href={`/groups/${groupId}/players/${s.player.id}`}
                  className="block"
                >
                  {s.player.name}
                </Link>
              </TableCell>
              <TableCell data-column="total_yuan" className="px-2 py-4 text-right">
                <Link
                  href={`/groups/${groupId}/players/${s.player.id}`}
                  className="block"
                >
                  <ChipValue chips={s.total_yuan} prefix="¥" />
                </Link>
              </TableCell>
              <TableCell data-column="total_chips" className={`${columnClass('total_chips')} px-2 py-4 text-right`}>
                <Link
                  href={`/groups/${groupId}/players/${s.player.id}`}
                  className="block"
                >
                  <ChipValue chips={s.total_chips} />
                </Link>
              </TableCell>
              <TableCell data-column="sessions_played" className={`${columnClass('sessions_played')} px-2 py-4 text-right text-muted-foreground`}>
                <Link
                  href={`/groups/${groupId}/players/${s.player.id}`}
                  className="block"
                >
                  {s.sessions_played}
                </Link>
              </TableCell>
              <TableCell data-column="win_rate" className={`${columnClass('win_rate')} px-2 py-4 text-right text-muted-foreground`}>
                <Link
                  href={`/groups/${groupId}/players/${s.player.id}`}
                  className="block"
                >
                  {(s.win_rate * 100).toFixed(0)}%
                </Link>
              </TableCell>
              <TableCell data-column="pog_count" className={`${columnClass('pog_count')} pl-2 pr-5 py-4 text-right text-muted-foreground`}>
                <Link
                  href={`/groups/${groupId}/players/${s.player.id}`}
                  className="block"
                >
                  {s.pog_count}
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
