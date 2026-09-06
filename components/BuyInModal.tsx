'use client'

import PlayerSelectionModal from './PlayerSelectionModal'
import { addBatchBuyIn, addBatchSessionParticipants } from '@/lib/client'
import type { SelectablePlayer } from '@/lib/player-selection'

interface Props {
  open: boolean
  groupId: string
  sessionId: string
  participants: SelectablePlayer[]
  unit: number
  mode?: 'buy-in' | 'join'
  onCreatePlayer?: (name: string) => Promise<SelectablePlayer>
  onClose: () => void
  onSaved: () => void
}

// Session persistence is an adapter to the shared picker, not a group/draft mode.
export default function BuyInModal({ groupId, sessionId, unit, mode = 'buy-in', onSaved, ...picker }: Props) {
  const record = mode === 'join' ? addBatchSessionParticipants : addBatchBuyIn
  return <PlayerSelectionModal {...picker} picker={mode === 'join' ? 'available' : 'session'}
    action={{ kind: 'buy-in', unit, record: command => record(groupId, sessionId, command), onSaved }} />
}
