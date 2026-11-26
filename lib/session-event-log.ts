import { groupByPlayer } from './session-results'
import type { LiveBuyIn, OpeningPlayer, SessionDetail, SessionEvent } from './domain-types'

interface Source {
  session: Pick<SessionDetail, 'started_at' | 'ended_at' | 'status'> & { created_at: string }
  participants: { player_id: string; created_at: string; settled_at: string | null; final_chips: number | null }[]
  buy_ins: LiveBuyIn[]
  names: Map<string, string>
}

const namesList = new Intl.ListFormat('en', { type: 'conjunction' })
const chips = (amount: number) => amount.toLocaleString('en-US') + ' chips'

function openingSummary(players: OpeningPlayer[]) {
  const byAmount = new Map<number | undefined, string[]>()
  for (const { amount, name } of players) {
    const group = byAmount.get(amount) ?? []
    group.push(name)
    byAmount.set(amount, group)
  }
  const groups = [...byAmount].sort((a, b) => b[1].length - a[1].length)
  const sentences = groups.map(([amount, players]) => {
    const names = namesList.format(players.sort())
    if (amount === undefined) return `${names} joined.`
    return `${names} bought in for ${chips(amount)}${players.length > 1 ? ' each' : ''}.`
  })
  return ['Session started.', ...sentences].join(' ')
}

export function filteredEventText(event: SessionEvent, selected: ReadonlySet<string>) {
  if (!selected.size) return event.text
  if (event.opening) {
    const matching = event.opening.filter(player => selected.has(player.id))
    return matching.length ? openingSummary(matching) : null
  }
  return event.player && selected.has(event.player.id) ? event.text : null
}

const legacyWriteWindowMs = 1000

// Older sessions wrote joins and initial buy-ins separately. Only the first
// buy-in can use the timing fallback. At opening, either insert could finish first.
function matchesJoin(buyTime: string, joinTime: string, firstLegacyBuy: boolean, opening: boolean) {
  if (buyTime === joinTime) return true
  if (!firstLegacyBuy) return false
  const lag = Date.parse(buyTime) - Date.parse(joinTime)
  return Math.abs(lag) < legacyWriteWindowMs && (opening || lag >= 0)
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
  function add(id: string, time: string, text: string, metadata?: Pick<SessionEvent, 'player' | 'opening'>) {
    const instant = Date.parse(time)
    if (instant >= startMs && instant <= endMs) {
      events.push({ id, time, text, ...metadata })
    }
  }

  // The aggregate query returns both participants and buy-ins in creation order.
  const firstJoin = participants[0]?.created_at
  const openingLag = firstJoin ? Date.parse(firstJoin) - startMs : Infinity
  const openingBatch = openingLag >= 0 && openingLag < legacyWriteWindowMs ? firstJoin : start
  const legacy = firstJoin !== start
  const buysByPlayer = groupByPlayer(buy_ins)
  const initialBuyIds = new Set<string>()
  const opening: OpeningPlayer[] = []
  for (const { player_id, created_at, settled_at, final_chips } of participants) {
    const name = names.get(player_id) ?? player_id
    const player = { id: player_id, name }
    const isOpening = created_at === openingBatch
    let amount: number | undefined
    const buys = buysByPlayer.get(player_id) ?? []
    for (const [index, buy] of buys.entries()) {
      if (matchesJoin(buy.created_at, created_at, legacy && index === 0, isOpening)) {
        initialBuyIds.add(buy.id)
        amount = (amount ?? 0) + buy.amount
      }
    }
    // Table settlement stamps the remaining players with the session end time.
    if (settled_at && final_chips !== null && Date.parse(settled_at) < endMs) {
      add(`cash-out-${player_id}`, settled_at, `${name} cashed out with ${chips(final_chips)}.`, { player })
    }
    if (isOpening) {
      opening.push({ ...player, amount })
    } else {
      const text = amount === undefined ? `${name} joined.` : `${name} joined with ${chips(amount)}.`
      add(`join-${player_id}`, created_at, text, { player })
    }
  }
  for (const buy of buy_ins) {
    if (initialBuyIds.has(buy.id)) continue
    const player = names.get(buy.player_id) ?? buy.player_id
    add(buy.id, buy.created_at, `${player} bought in for ${chips(buy.amount)}.`, { player: { id: buy.player_id, name: player } })
  }
  add('start', start, openingSummary(opening), { opening })
  if (session.status === 'SETTLED' && end) add('settled', end, 'Session settled.')
  return events.sort((a, b) => Date.parse(b.time) - Date.parse(a.time) || b.id.localeCompare(a.id))
}
