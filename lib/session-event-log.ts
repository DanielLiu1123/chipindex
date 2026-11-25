import type { LiveBuyIn } from './domain-types'

export interface SessionEvent {
  id: string
  time: string
  text: string
}

interface Source {
  session: { started_at: string | null; ended_at: string | null; status: string }
  participants: { player_id: string; created_at: string }[]
  buy_ins: LiveBuyIn[]
  names: Map<string, string>
}

const namesList = new Intl.ListFormat('en', { type: 'conjunction' })
const chips = (amount: number) => amount.toLocaleString('en-US') + ' chips'

export function sessionEventLog({ session, participants, buy_ins, names }: Source, enabledAt?: string): SessionEvent[] {
  if (!session.started_at) return [] // Imported sessions have no live timeline.
  const start = session.started_at
  const end = session.ended_at
  // New sessions stamp the opening roster with the session start instant.
  // Older live sessions need the fixed rollout boundary to avoid backfilling.
  const cutoff = enabledAt ? Date.parse(enabledAt) :
    participants.some(p => p.created_at === start) ? Date.parse(start) : Infinity
  const events: SessionEvent[] = []
  function add(id: string, time: string, text: string) {
    const instant = Date.parse(time)
    if (instant >= cutoff && instant >= Date.parse(start) && (!end || instant <= Date.parse(end))) {
      events.push({ id, time, text })
    }
  }

  const joins = new Map(participants.map(p => [p.player_id, p.created_at]))
  const initialAmounts = new Map<string, number>()
  for (const buy of buy_ins) {
    if (joins.get(buy.player_id) === buy.created_at) {
      initialAmounts.set(buy.player_id, (initialAmounts.get(buy.player_id) ?? 0) + buy.amount)
    } else {
      add(buy.id, buy.created_at, (names.get(buy.player_id) ?? buy.player_id) + ' bought in for ' + chips(buy.amount) + '.')
    }
  }
  const opening = new Map<number | undefined, string[]>()
  for (const p of participants) {
    const name = names.get(p.player_id) ?? p.player_id
    const amount = initialAmounts.get(p.player_id)
    if (p.created_at === start) {
      const group = opening.get(amount) ?? []
      group.push(name)
      opening.set(amount, group)
    } else {
      add('join-' + p.player_id, p.created_at, name + (amount === undefined ? ' joined.' : ' joined with ' + chips(amount) + '.'))
    }
  }
  const sentences = ['Session started.']
  for (const [amount, players] of [...opening].sort((a, b) => b[1].length - a[1].length)) {
    sentences.push(namesList.format(players.sort()) + (amount === undefined ? ' joined.' :
      ' bought in for ' + chips(amount) + (players.length > 1 ? ' each.' : '.')))
  }
  add('start', start, sentences.join(' '))
  if (session.status === 'SETTLED' && end) add('settled', end, 'Session settled.')
  return events.sort((a, b) => Date.parse(b.time) - Date.parse(a.time) || b.id.localeCompare(a.id))
}
