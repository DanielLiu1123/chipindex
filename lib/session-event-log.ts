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
  if ('opening' in event) {
    if (!selected.size) return openingSummary(event.opening)
    const matching = event.opening.filter(player => selected.has(player.id))
    return matching.length ? openingSummary(matching) : null
  }
  if (selected.size && !(event.player && selected.has(event.player.id))) return null
  return event.text
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
  function add(event: SessionEvent) {
    const instant = Date.parse(event.time)
    if (instant >= startMs && instant <= endMs) {
      events.push(event)
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
    const player = { id: player_id, name: names.get(player_id) ?? player_id }
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
      add({ id: `cash-out-${player_id}`, time: settled_at, player, text: `${player.name} cashed out with ${chips(final_chips)}.` })
    }
    if (isOpening) {
      opening.push({ ...player, amount })
    } else {
      const text = amount === undefined ? `${player.name} joined.` : `${player.name} joined with ${chips(amount)}.`
      add({ id: `join-${player_id}`, time: created_at, player, text })
    }
  }
  for (const buy of buy_ins) {
    if (initialBuyIds.has(buy.id)) continue
    const player = { id: buy.player_id, name: names.get(buy.player_id) ?? buy.player_id }
    add({ id: buy.id, time: buy.created_at, player, text: `${player.name} bought in for ${chips(buy.amount)}.` })
  }
  add({ id: 'start', time: start, opening })
  if (session.status === 'SETTLED' && end) add({ id: 'settled', time: end, text: 'Session settled.' })
  return events.sort((a, b) => Date.parse(b.time) - Date.parse(a.time) || b.id.localeCompare(a.id))
}
