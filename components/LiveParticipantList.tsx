import ChipValue from '@/components/ChipValue'
import type { LiveParticipant } from '@/lib/queries'
import { isCashedOut } from '@/lib/live-session'

interface Props {
  participants: LiveParticipant[]
  expanded: ReadonlySet<string>
  customAmounts: Readonly<Record<string, string>>
  buyInUnit: number
  pending: boolean
  interactive: boolean
  onToggle: (playerId: string) => void
  onCustomAmountChange: (playerId: string, value: string) => void
  onAddBuyIn: (playerId: string, amount: number) => void
  onRevokeBuyIn: (buyInId: string) => void
  onCashOut: (participant: LiveParticipant) => void
  onUndoCashOut: (playerId: string) => void
  onRemove: (participant: LiveParticipant) => void
}

export default function LiveParticipantList({
  participants,
  expanded,
  customAmounts,
  buyInUnit,
  pending,
  interactive,
  onToggle,
  onCustomAmountChange,
  onAddBuyIn,
  onRevokeBuyIn,
  onCashOut,
  onUndoCashOut,
  onRemove,
}: Props) {
  function addCustom(playerId: string) {
    const amount = Number(customAmounts[playerId])
    if (Number.isInteger(amount) && amount > 0) onAddBuyIn(playerId, amount)
  }

  if (participants.length === 0) {
    return <p className="text-muted text-xs tracking-widest py-6 text-center">NO PLAYERS YET — ADD SOMEONE BELOW</p>
  }

  return participants.map(participant => {
    const cashedOut = isCashedOut(participant)
    const finalChips = participant.final_chips ?? 0
    const netChips = finalChips - participant.total_buyin

    return (
      <div key={participant.player_id} className={`border border-border ${cashedOut ? 'bg-surface/40' : ''}`}>
        <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-center sm:gap-2 sm:py-2.5">
          <div className="flex items-start gap-3 sm:contents">
            <button onClick={() => onToggle(participant.player_id)} className="flex min-w-0 flex-1 items-start gap-2 text-left sm:items-baseline">
              <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug text-white sm:flex-none">{participant.name}</span>
              {cashedOut ? (
                <span className="shrink-0 whitespace-nowrap text-xs text-muted">
                  CASHED OUT · {new Date(participant.settled_at!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : <span className="shrink-0 text-xs text-muted">{participant.buy_ins.length}×</span>}
            </button>
            {cashedOut ? (
              <span className="shrink-0 whitespace-nowrap text-xs"><ChipValue chips={netChips} /></span>
            ) : <span className="shrink-0 whitespace-nowrap text-sm text-white tabular-nums">{participant.total_buyin.toLocaleString()}</span>}
          </div>
          {interactive && !cashedOut && (
            <div className="flex items-center gap-2 sm:contents">
              <button onClick={() => onAddBuyIn(participant.player_id, buyInUnit)} disabled={pending}
                className="flex-1 border border-accent/40 px-2 py-1.5 text-xs tracking-widest text-accent transition-colors hover:border-accent disabled:opacity-40 sm:flex-none sm:py-1">
                +{buyInUnit.toLocaleString()}
              </button>
              <button onClick={() => onCashOut(participant)} disabled={pending}
                className="flex-1 border border-amber-400/40 px-2 py-1.5 text-xs tracking-widest text-amber-400 transition-colors hover:border-amber-400 disabled:opacity-40 sm:flex-none sm:py-1">
                CASH OUT
              </button>
              <button onClick={() => onRemove(participant)} disabled={pending}
                className="px-1 text-sm text-muted transition-colors hover:text-danger disabled:opacity-40" aria-label="remove player">
                ✕
              </button>
            </div>
          )}
          {interactive && cashedOut && (
            <button onClick={() => onUndoCashOut(participant.player_id)} disabled={pending}
              className="text-xs text-muted hover:text-white px-1 tracking-widest transition-colors disabled:opacity-40">
              UNDO
            </button>
          )}
        </div>

        {cashedOut && (
          <div className="px-3 pb-2.5 text-xs text-muted">
            Buy-in {participant.total_buyin.toLocaleString()} · Final {finalChips.toLocaleString()} · Net {netChips >= 0 ? '+' : ''}{netChips.toLocaleString()}
          </div>
        )}

        {interactive && expanded.has(participant.player_id) && (
          <div className="border-t border-border px-3 py-2 bg-surface/50">
            {participant.buy_ins.length > 0 && (
              <div className="flex flex-col gap-1 mb-2">
                {participant.buy_ins.map(buyIn => (
                  <div key={buyIn.id} className="flex items-center justify-between text-xs text-muted">
                    <span>{new Date(buyIn.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · +{buyIn.amount.toLocaleString()}</span>
                    {!cashedOut && (
                      <button onClick={() => onRevokeBuyIn(buyIn.id)} disabled={pending}
                        className="hover:text-danger transition-colors px-1">✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!cashedOut && (
              <div className="flex items-center gap-2">
                <input type="number" inputMode="numeric" value={customAmounts[participant.player_id] ?? ''} min="1"
                  onChange={event => onCustomAmountChange(participant.player_id, event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter') addCustom(participant.player_id) }}
                  placeholder="custom amount"
                  className="flex-1 bg-surface border border-border text-white text-xs px-3 py-2 outline-none focus:border-white transition-colors placeholder:text-muted" />
                <button onClick={() => addCustom(participant.player_id)} disabled={pending}
                  className="text-xs text-accent tracking-widest px-2 py-2 hover:underline disabled:opacity-40">ADD</button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  })
}
