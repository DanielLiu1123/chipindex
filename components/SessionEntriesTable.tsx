'use client'

import { useRouter } from 'next/navigation'
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
  const router = useRouter()

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
          <tr key={e.id} onClick={() => router.push(`/players/${e.player_id}`)}
            className="border-b border-border hover:bg-surface transition-colors cursor-pointer">
            <td className="py-4">{e.players?.name ?? e.player_id}</td>
            <td className="py-4 text-right text-muted">
              <ChipValue chips={Math.round(e.chips / exchangeRate)} prefix="¥" />
            </td>
            <td className="py-4 text-right"><ChipValue chips={e.chips} /></td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="text-muted text-xs">
          <td className="pt-4">SUM</td>
          <td className="pt-4 text-right"><ChipValue chips={total} /></td>
          <td />
        </tr>
      </tfoot>
    </table>
  )
}
