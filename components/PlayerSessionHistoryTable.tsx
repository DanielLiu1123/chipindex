import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import Link from 'next/link'
import ChipValue from '@/components/ChipValue'

interface HistoryRow {
  date: string
  cny: number
  chips: number
  cumulative_cny: number
  cumulative: number
  session_id: string
}

export default function PlayerSessionHistoryTable({ groupId, rows }: { groupId: string; rows: HistoryRow[] }) {
  return (
    <Table className="w-full text-sm">
      <TableHeader>
        <TableRow className="border-b border-border text-muted-foreground text-[10px] sm:text-xs leading-4 tracking-normal">
          <TableHead className="text-left py-3 px-1 first:pl-0 last:pr-0 font-normal">DATE</TableHead>
          <TableHead className="text-right py-3 px-1 first:pl-0 last:pr-0 font-normal">CNY</TableHead>
          <TableHead className="text-right py-3 px-1 first:pl-0 last:pr-0 font-normal">CHIPS</TableHead>
          <TableHead className="text-right py-3 px-1 first:pl-0 last:pr-0 font-normal">
            <span className="sm:hidden">CUM. CNY</span>
            <span className="hidden sm:inline">CUMULATIVE CNY</span>
          </TableHead>
          <TableHead className="text-right py-3 px-1 first:pl-0 last:pr-0 font-normal">
            <span className="sm:hidden">CUM. CHIPS</span>
            <span className="hidden sm:inline">CUMULATIVE CHIPS</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && <TableRow><TableCell colSpan={5} className="py-12 text-center text-xs text-muted-foreground tracking-normal">NO SESSIONS YET</TableCell></TableRow>}
        {rows.map(row => (
          <TableRow key={row.session_id} className="border-b border-border hover:bg-muted transition-colors">
            <TableCell className="py-4 px-1 first:pl-0 last:pr-0">
              <Link href={`/groups/${groupId}/sessions/${row.session_id}`} className="block">{row.date}</Link>
            </TableCell>
            <TableCell className="py-4 px-1 first:pl-0 last:pr-0 text-right">
              <Link href={`/groups/${groupId}/sessions/${row.session_id}`} className="block"><ChipValue chips={row.cny} prefix="¥" /></Link>
            </TableCell>
            <TableCell className="py-4 px-1 first:pl-0 last:pr-0 text-right">
              <Link href={`/groups/${groupId}/sessions/${row.session_id}`} className="block"><ChipValue chips={row.chips} /></Link>
            </TableCell>
            <TableCell className="py-4 px-1 first:pl-0 last:pr-0 text-right">
              <Link href={`/groups/${groupId}/sessions/${row.session_id}`} className="block"><ChipValue chips={row.cumulative_cny} prefix="¥" /></Link>
            </TableCell>
            <TableCell className="py-4 px-1 first:pl-0 last:pr-0 text-right">
              <Link href={`/groups/${groupId}/sessions/${row.session_id}`} className="block"><ChipValue chips={row.cumulative} /></Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
