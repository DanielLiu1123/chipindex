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
    <>
      <section className="sm:hidden" aria-label="Session history">
        {rows.map(row => (
          <Link
            key={row.session_id}
            href={`/groups/${groupId}/sessions/${row.session_id}`}
            className="block border-b border-border py-4 active:bg-surface"
          >
            <p className="mb-3 text-sm text-white">{row.date}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <dt className="mb-1 text-[10px] tracking-widest text-muted">CNY</dt>
                <dd className="text-sm"><ChipValue chips={row.cny} prefix="¥" /></dd>
              </div>
              <div className="text-right">
                <dt className="mb-1 text-[10px] tracking-widest text-muted">CHIPS</dt>
                <dd className="text-sm"><ChipValue chips={row.chips} /></dd>
              </div>
              <div>
                <dt className="mb-1 text-[10px] tracking-widest text-muted">CUMULATIVE CNY</dt>
                <dd className="text-sm"><ChipValue chips={row.cumulative_cny} prefix="¥" /></dd>
              </div>
              <div className="text-right">
                <dt className="mb-1 text-[10px] tracking-widest text-muted">CUMULATIVE CHIPS</dt>
                <dd className="text-sm"><ChipValue chips={row.cumulative} /></dd>
              </div>
            </dl>
          </Link>
        ))}
      </section>

      <table className="hidden w-full text-sm sm:table">
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
    </>
  )
}
