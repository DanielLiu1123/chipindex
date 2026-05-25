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

export default function PlayerSessionHistoryTable({ rows }: { rows: HistoryRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-muted text-xs tracking-widest">
          <th className="text-left py-3 font-normal">DATE</th>
          <th className="text-right py-3 font-normal">CNY</th>
          <th className="text-right py-3 font-normal">CHIPS</th>
          <th className="text-right py-3 font-normal">CUMULATIVE CNY</th>
          <th className="text-right py-3 font-normal">CUMULATIVE CHIPS</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.session_id} className="border-b border-border hover:bg-surface transition-colors">
            <td className="py-4">
              <Link href={`/sessions/${row.session_id}`} className="block">{row.date}</Link>
            </td>
            <td className="py-4 text-right">
              <Link href={`/sessions/${row.session_id}`} className="block"><ChipValue chips={row.cny} prefix="¥" /></Link>
            </td>
            <td className="py-4 text-right">
              <Link href={`/sessions/${row.session_id}`} className="block"><ChipValue chips={row.chips} /></Link>
            </td>
            <td className="py-4 text-right">
              <Link href={`/sessions/${row.session_id}`} className="block"><ChipValue chips={row.cumulative_cny} prefix="¥" /></Link>
            </td>
            <td className="py-4 text-right">
              <Link href={`/sessions/${row.session_id}`} className="block"><ChipValue chips={row.cumulative} /></Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
