import type { LiveParticipant } from './queries'
import type { BatchBuyInCommand } from './contracts'

// Wait for the saved request to appear in refreshed data; never add its amount
// locally, since a retried request may already be included in the total.
export function completedBuyInTotals(participants: LiveParticipant[], command: BatchBuyInCommand) {
  const totals: Pick<LiveParticipant, 'player_id' | 'name' | 'total_buyin'>[] = []
  for (const entry of command.entries) {
    const player = participants.find(player => player.player_id === entry.player_id)
    if (!player?.buy_ins.some(buyIn => buyIn.id === entry.id)) return null
    totals.push({ player_id: player.player_id, name: player.name, total_buyin: player.total_buyin })
  }
  return totals.length ? totals : null
}

