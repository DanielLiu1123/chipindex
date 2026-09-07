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

export type FinalChipDrafts = Readonly<Record<string, string>>

export interface LiveSessionSummary {
  pot: number
  cashedOutTotal: number
  totalFinal: number
  settleDiff: number
  allFinalsFilled: boolean
}

export function isCashedOut(participant: LiveParticipant): boolean {
  return participant.settled_at !== null
}

export function activeFinalEntries(participants: LiveParticipant[], drafts: FinalChipDrafts) {
  return participants
    .filter(participant => !isCashedOut(participant))
    .map(participant => ({
      player_id: participant.player_id,
      final_chips: Number(drafts[participant.player_id]),
    }))
}

export function summarizeLiveSession(
  participants: LiveParticipant[],
  drafts: FinalChipDrafts,
): LiveSessionSummary {
  let pot = 0
  let cashedOutTotal = 0
  let totalFinal = 0
  let allFinalsFilled = true

  for (const participant of participants) {
    pot += participant.total_buyin
    if (isCashedOut(participant)) {
      const finalChips = participant.final_chips ?? 0
      cashedOutTotal += finalChips
      totalFinal += finalChips
      continue
    }

    const draft = drafts[participant.player_id]
    if (draft === undefined || draft === '') allFinalsFilled = false
    totalFinal += Number(draft) || 0
  }

  return {
    pot,
    cashedOutTotal,
    totalFinal,
    settleDiff: totalFinal - pot,
    allFinalsFilled,
  }
}
