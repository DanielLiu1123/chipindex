import type { LiveParticipant } from './queries'
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
