import Link from 'next/link'
import ChipValue from '@/components/ChipValue'

interface Entry {
  id: string
  player_id: string
  chips: number
  players?: { name: string } | null
}

export default function SessionEntriesTable({ entries, exchangeRate, total }: {
  entries: Entry[]
  exchangeRate: number
  total: number
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-muted text-xs tracking-widest">
          <th className="text-left py-3 font-normal">PLAYER</th>
          <th className="text-right py-3 font-normal">CNY</th>
          <th className="text-right py-3 font-normal">CHIPS</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(e => (
          <tr key={e.id} className="border-b border-border hover:bg-surface transition-colors">
            <td className="py-4">
              <Link href={`/players/${e.player_id}`} className="block">{e.players?.name ?? e.player_id}</Link>
            </td>
            <td className="py-4 text-right text-muted">
              <Link href={`/players/${e.player_id}`} className="block">
                <ChipValue chips={Math.round(e.chips / exchangeRate)} prefix="¥" />
              </Link>
            </td>
            <td className="py-4 text-right">
              <Link href={`/players/${e.player_id}`} className="block">
                <ChipValue chips={e.chips} />
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="text-muted text-xs">
          <td className="pt-4">SUM</td>
          <td />
          <td className="pt-4 text-right"><ChipValue chips={total} /></td>
        </tr>
      </tfoot>
    </table>
  )
}
