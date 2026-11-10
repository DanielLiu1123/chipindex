import { ResponsiveTable, ResponsiveHead, ResponsiveCell } from '@/components/ResponsiveTable'
import { TableHeader, TableRow, TableBody } from '@/components/ui/table'
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
  prefix?: string
}[] = [
  { key: 'date', label: 'DATE' },
  { key: 'cny', label: 'CNY', prefix: '¥' },
  { key: 'chips', label: 'CHIPS' },
  { key: 'cumulative_cny', label: 'CUM. CNY', prefix: '¥' },
  { key: 'cumulative', label: 'CUM. CHIPS' },
]

const layoutColumns = columns.map(column => ({ key: column.key, minWidth: column.key === 'date' ? 104 : 108 }))
const hideOrder = ['cumulative', 'chips', 'cumulative_cny']

export default function PlayerSessionHistoryTable({ groupId, rows, loading = false }: {
  groupId: string
  rows: HistoryRow[]
  loading?: boolean
}) {
  return (
    <ResponsiveTable columns={layoutColumns} hideOrder={hideOrder} className="[&_th]:px-2 [&_td]:px-2">
      <TableHeader>
        <TableRow className="border-border text-muted-foreground text-xs leading-4 tracking-normal [&_th]:py-3 [&_th]:font-normal [&_th]:text-right [&_th:first-child]:text-left">
          {columns.map(column => {
            return <ResponsiveHead column={column.key} key={column.key}>
              {loading ? <Skeleton className={column.key === 'date' ? 'h-4 w-16' : 'ml-auto h-4 w-16'} /> : column.label}
            </ResponsiveHead>
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && <TableRow><ResponsiveCell span className="py-12 text-center text-xs text-muted-foreground tracking-normal">NO SESSIONS YET</ResponsiveCell></TableRow>}
        {rows.map(row => (
          <TableRow key={row.session_id} className="border-border hover:bg-muted [&_td]:py-4 [&_td]:text-right [&_td:first-child]:text-left">
            {columns.map(column => <ResponsiveCell column={column.key} key={column.key}>
              {loading ? <Skeleton className={column.key === 'date' ? 'h-5 w-24' : 'ml-auto h-5 w-16'} /> :
                <Link href={`/groups/${groupId}/sessions/${row.session_id}`} className="block">
                  {column.key === 'date' ? row.date : <ChipValue chips={row[column.key]} prefix={column.prefix} />}
                </Link>}
            </ResponsiveCell>)}
          </TableRow>
        ))}
      </TableBody>
    </ResponsiveTable>
  )
}
