import type { LiveBuyIn, SessionDetail, SessionEvent } from './domain-types'

interface Source {
  session: Pick<SessionDetail, 'started_at' | 'ended_at' | 'status'> & { created_at: string }
  participants: { player_id: string; created_at: string }[]
  buy_ins: LiveBuyIn[]
  names: Map<string, string>
}

const namesList = new Intl.ListFormat('en', { type: 'conjunction' })
const chips = (amount: number) => amount.toLocaleString('en-US') + ' chips'

function openingSummary(opening: Map<number | undefined, string[]>) {
  const groups = [...opening].sort((a, b) => b[1].length - a[1].length)
  const sentences = groups.map(([amount, players]) => {
    const names = namesList.format(players.sort())
    if (amount === undefined) return `${names} joined.`
    return `${names} bought in for ${chips(amount)}${players.length > 1 ? ' each' : ''}.`
  })
  return ['Session started.', ...sentences].join(' ')
}

export function sessionEventLog({ session, participants, buy_ins, names }: Source): SessionEvent[] {
  if (!session.started_at && session.status === 'SETTLED') {
    // Import synthesizes buy-ins from net results; only the import time is known.
    return [{ id: 'import', time: session.created_at, text: 'Session imported.' }]
  }
  const start = session.started_at ?? session.created_at
  const end = session.ended_at
  const startMs = Date.parse(start)
  const endMs = end ? Date.parse(end) : Infinity
  const events: SessionEvent[] = []
  function add(id: string, time: string, text: string) {
    const instant = Date.parse(time)
    if (instant >= startMs && instant <= endMs) {
      events.push({ id, time, text })
    }
  }

  // Older clients wrote the opening roster and its buy-ins in separate requests.
  // Only the earliest roster batch and each player's first buy-in can be folded.
  const firstJoin = participants.reduce<string | undefined>((first, p) =>
    !first || Date.parse(p.created_at) < Date.parse(first) ? p.created_at : first, undefined)
  const legacy = firstJoin !== start
  const openingBatch = firstJoin && Date.parse(firstJoin) >= startMs && Date.parse(firstJoin) - startMs < 1000
    ? firstJoin : start
  const joins = new Map(participants.map(p => [p.player_id, p.created_at]))
  const initialAmounts = new Map<string, number>()
  const seenBuyers = new Set<string>()
  for (const buy of buy_ins) {
    const joined = joins.get(buy.player_id)
    const lag = Date.parse(buy.created_at) - Date.parse(joined ?? '')
    const nearJoin = legacy && !seenBuyers.has(buy.player_id) && Math.abs(lag) < 1000 &&
      (lag >= 0 || joined === openingBatch) // Opening inserts ran concurrently.
    seenBuyers.add(buy.player_id)
    if (joined === buy.created_at || nearJoin) {
      initialAmounts.set(buy.player_id, (initialAmounts.get(buy.player_id) ?? 0) + buy.amount)
    } else {
      const player = names.get(buy.player_id) ?? buy.player_id
      add(buy.id, buy.created_at, `${player} bought in for ${chips(buy.amount)}.`)
    }
  }
  const opening = new Map<number | undefined, string[]>()
  for (const { player_id, created_at } of participants) {
    const name = names.get(player_id) ?? player_id
    const amount = initialAmounts.get(player_id)
    if (created_at === openingBatch) {
      const group = opening.get(amount) ?? []
      group.push(name)
      opening.set(amount, group)
    } else {
      const text = amount === undefined ? `${name} joined.` : `${name} joined with ${chips(amount)}.`
      add(`join-${player_id}`, created_at, text)
    }
  }
  add('start', start, openingSummary(opening))
  if (session.status === 'SETTLED' && end) add('settled', end, 'Session settled.')
  return events.sort((a, b) => Date.parse(b.time) - Date.parse(a.time) || b.id.localeCompare(a.id))
}
