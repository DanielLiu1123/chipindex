import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import Link from 'next/link'
import ChipValue from '@/components/ChipValue'
import { Skeleton } from '@/components/ui/skeleton'

interface HistoryRow {
  date: string
  cny: number
  chips: number
  cumulative_cny: number
  cumulative: number
  session_id: string
}

const columns: {
  key: Exclude<keyof HistoryRow, 'session_id'>
  label: string
  mobileLabel?: string
  prefix?: string
}[] = [
  { key: 'date', label: 'DATE' },
  { key: 'cny', label: 'CNY', prefix: '¥' },
  { key: 'chips', label: 'CHIPS' },
  { key: 'cumulative_cny', label: 'CUMULATIVE CNY', mobileLabel: 'CUM. CNY', prefix: '¥' },
  { key: 'cumulative', label: 'CUMULATIVE CHIPS', mobileLabel: 'CUM. CHIPS' },
]

export default function PlayerSessionHistoryTable({ groupId, rows, loading = false }: {
  groupId: string
  rows: HistoryRow[]
  loading?: boolean
}) {
  return (
    <Table className="[&_th]:px-1 [&_td]:px-1 [&_tr>:first-child]:pl-3 [&_tr>:last-child]:pr-3 sm:[&_tr>:first-child]:pl-4 sm:[&_tr>:last-child]:pr-4">
      <TableHeader>
        <TableRow className="border-border text-muted-foreground text-[10px] sm:text-xs leading-4 tracking-normal [&_th]:py-3 [&_th]:font-normal [&_th]:text-right [&_th:first-child]:text-left">
          {columns.map(column => {
            const label = column.mobileLabel ? <>
              <span className="sm:hidden">{column.mobileLabel}</span>
              <span className="hidden sm:inline">{column.label}</span>
            </> : column.label
            return <TableHead key={column.key}>
              {loading ? <Skeleton className={column.key === 'date' ? 'h-4 w-16' : 'ml-auto h-4 w-16'} /> : label}
            </TableHead>
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && <TableRow><TableCell colSpan={columns.length} className="py-12 text-center text-xs text-muted-foreground tracking-normal">NO SESSIONS YET</TableCell></TableRow>}
        {rows.map(row => (
          <TableRow key={row.session_id} className="border-border hover:bg-muted [&_td]:py-4 [&_td]:text-right [&_td:first-child]:text-left">
            {columns.map(column => <TableCell key={column.key}>
              {loading ? <Skeleton className={column.key === 'date' ? 'h-5 w-24' : 'ml-auto h-5 w-16'} /> :
                <Link href={`/groups/${groupId}/sessions/${row.session_id}`} className="block">
                  {column.key === 'date' ? row.date : <ChipValue chips={row[column.key]} prefix={column.prefix} />}
                </Link>}
            </TableCell>)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
