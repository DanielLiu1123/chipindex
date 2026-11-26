import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import ChipValue from '@/components/ChipValue'
import { cn } from '@/lib/utils'
import { sortLeaderboard, type LeaderboardSortKey as SortKey } from '@/lib/leaderboard'
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

function SortHeader({
  label,
  sortKey: key,
  currentKey,
  sortDir,
  onSort,
  className = '',
}: {
  label: string
  className?: string
  sortKey: SortKey
  currentKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
}) {
  const active = currentKey === key
  return (
    <TableHead data-column={key} aria-sort={active ? (sortDir === 'desc' ? 'descending' : 'ascending') : undefined} className={cn("px-2 py-3 font-normal text-right", className)}>
      <Button variant="ghost" className="px-0 text-xs" type="button" onClick={() => onSort(key)}>
        {label}
        {active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
      </Button>
    </TableHead>
  )
}

export default function LeaderboardTable({ groupId, stats, sortKey, sortDir, onSort }: {
  groupId: string
  stats: PlayerStats[]
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
}) {
  const sortedStats = useMemo(() => sortLeaderboard(stats, sortKey, sortDir), [stats, sortKey, sortDir])
  const { containerRef, layout } = useLeaderboardLayout(sortedStats)

  useEffect(() => {
    if (layout && !layout.visible.includes(sortKey)) {
      onSort('total_yuan')
    }
  }, [layout, sortKey, onSort])

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
            <SortHeader
              currentKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              label="CNY"
              sortKey="total_yuan"
            />
            <SortHeader
              currentKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              label="CHIPS"
              className={columnClass('total_chips')}
              sortKey="total_chips"
            />
            <SortHeader
              currentKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              label="SESSIONS"
              className={columnClass('sessions_played')}
              sortKey="sessions_played"
            />
            <SortHeader
              currentKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              label="WIN%"
              className={columnClass('win_rate')}
              sortKey="win_rate"
            />
            <SortHeader
              currentKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              label="POG"
              className={cn(columnClass('pog_count'), 'pr-5')}
              sortKey="pog_count"
            />
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
