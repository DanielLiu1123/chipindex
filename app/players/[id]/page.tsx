import Link from 'next/link'
import { selectOne } from '@/lib/db'
import ChipValue from '@/components/ChipValue'
import PlayerChart from '@/components/PlayerChart'

export const dynamic = 'force-dynamic'

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const player = await selectOne('players', `id=eq.${id}&select=*,session_entries(*,sessions(*))`)

  const sessionsSorted = [...(player.session_entries ?? [])]
    .filter((e: any) => e.sessions)
    .sort((a: any, b: any) => a.sessions.date.localeCompare(b.sessions.date))

  let cumulative = 0
  const history = sessionsSorted.map((e: any) => {
    cumulative += e.chips
    return { date: e.sessions.date, chips: e.chips, cumulative }
  })

  const totalChips = history.length > 0 ? history[history.length - 1].cumulative : 0
  const wins = sessionsSorted.filter((e: any) => e.chips > 0).length

  return (
    <>
      <div className="mb-6">
        <Link href="/" className="text-muted text-xs hover:text-white tracking-widest">← LEADERBOARD</Link>
      </div>
      <div className="flex items-baseline justify-between mb-8">
        <h1 className="text-white text-lg">{player.name}</h1>
        <div className="flex gap-6 text-xs text-muted">
          <span>{sessionsSorted.length} sessions</span>
          <span>{wins} wins</span>
          <ChipValue chips={totalChips} className="text-sm" />
        </div>
      </div>

      {history.length > 1 && (
        <div className="mb-10 -mx-2">
          <p className="text-xs text-muted tracking-widest mb-4 mx-2">CUMULATIVE CHIPS</p>
          <PlayerChart data={history} positive={totalChips >= 0} />
        </div>
      )}

      <p className="text-xs text-muted tracking-widest mb-4">SESSION HISTORY</p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted text-xs tracking-widest">
            <th className="text-left py-3 font-normal">DATE</th>
            <th className="text-right py-3 font-normal">CHIPS</th>
            <th className="text-right py-3 font-normal">CUMULATIVE</th>
          </tr>
        </thead>
        <tbody>
          {[...history].reverse().map((row, i) => {
            const entry = [...sessionsSorted].reverse()[i]
            return (
              <tr key={i} className="border-b border-border hover:bg-surface transition-colors">
                <td className="py-4">
                  <Link href={`/sessions/${entry.session_id}`} className="hover:text-accent transition-colors">
                    {row.date}
                  </Link>
                </td>
                <td className="py-4 text-right"><ChipValue chips={row.chips} /></td>
                <td className="py-4 text-right"><ChipValue chips={row.cumulative} /></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </>
  )
}
