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
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-muted text-[10px] sm:text-xs leading-4 tracking-widest">
          <th className="text-left py-3 px-1 first:pl-0 last:pr-0 font-normal">DATE</th>
          <th className="text-right py-3 px-1 first:pl-0 last:pr-0 font-normal">CNY</th>
          <th className="text-right py-3 px-1 first:pl-0 last:pr-0 font-normal">CHIPS</th>
          <th className="text-right py-3 px-1 first:pl-0 last:pr-0 font-normal">
            <span className="sm:hidden">CUM. CNY</span>
            <span className="hidden sm:inline">CUMULATIVE CNY</span>
          </th>
          <th className="text-right py-3 px-1 first:pl-0 last:pr-0 font-normal">
            <span className="sm:hidden">CUM. CHIPS</span>
            <span className="hidden sm:inline">CUMULATIVE CHIPS</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.session_id} className="border-b border-border hover:bg-surface transition-colors">
            <td className="py-4 px-1 first:pl-0 last:pr-0">
              <Link href={`/groups/${groupId}/sessions/${row.session_id}`} className="block">{row.date}</Link>
            </td>
            <td className="py-4 px-1 first:pl-0 last:pr-0 text-right">
              <Link href={`/groups/${groupId}/sessions/${row.session_id}`} className="block"><ChipValue chips={row.cny} prefix="¥" /></Link>
            </td>
            <td className="py-4 px-1 first:pl-0 last:pr-0 text-right">
              <Link href={`/groups/${groupId}/sessions/${row.session_id}`} className="block"><ChipValue chips={row.chips} /></Link>
            </td>
            <td className="py-4 px-1 first:pl-0 last:pr-0 text-right">
              <Link href={`/groups/${groupId}/sessions/${row.session_id}`} className="block"><ChipValue chips={row.cumulative_cny} prefix="¥" /></Link>
            </td>
            <td className="py-4 px-1 first:pl-0 last:pr-0 text-right">
              <Link href={`/groups/${groupId}/sessions/${row.session_id}`} className="block"><ChipValue chips={row.cumulative} /></Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
