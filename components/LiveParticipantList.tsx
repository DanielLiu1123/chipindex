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
      <div key={participant.player_id} className="border border-border">
        {cashedOut ? (
          <div className="flex flex-nowrap items-center gap-1.5 px-3 py-2.5 sm:gap-2">
            <button
              onClick={() => onToggle(participant.player_id)}
              title={participant.name}
              className="min-w-0 flex-1 truncate text-left text-sm leading-snug text-white sm:text-base"
            >
              {participant.name}
            </button>
            <span className="shrink-0 whitespace-nowrap text-[10px] tracking-widest text-muted sm:text-xs">
              NET <ChipValue chips={netChips} className="tracking-normal tabular-nums" />
            </span>
            {interactive && (
              <div className="contents">
                <button onClick={() => onUndoCashOut(participant.player_id)} disabled={pending}
                  className="min-w-[4.75rem] shrink-0 cursor-pointer border border-white/40 bg-white/5 px-1.5 py-1.5 text-[10px] tracking-wide text-white transition-colors hover:border-white hover:bg-white hover:text-bg active:bg-accent focus-visible:border-accent focus-visible:outline-none disabled:cursor-default disabled:opacity-40 sm:px-2 sm:py-1 sm:text-xs sm:tracking-widest"
                  aria-label={`undo ${participant.name} cash out`}>
                  UNDO
                </button>
                <button onClick={() => onRemove(participant)} disabled={pending}
                  className="shrink-0 px-0.5 text-xs text-muted transition-colors hover:text-danger disabled:opacity-40 sm:px-1 sm:text-sm" aria-label="remove player">
                  ✕
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-nowrap items-center gap-1.5 px-3 py-2.5 sm:gap-2">
            <button
              onClick={() => onToggle(participant.player_id)}
              title={participant.name}
              className="min-w-0 flex-1 truncate text-left text-sm leading-snug text-white sm:text-base"
            >
              {participant.name}
            </button>
            <span className="shrink-0 whitespace-nowrap text-[11px] text-muted tabular-nums sm:text-xs">
              {participant.buy_ins.length}× <span className="text-white">{participant.total_buyin.toLocaleString()}</span>
            </span>
            {interactive && (
              <div className="contents">
                <button onClick={() => onAddBuyIn(participant.player_id, buyInUnit)} disabled={pending}
                  className="shrink-0 border border-accent/40 px-1.5 py-1.5 text-[10px] tracking-wide text-accent transition-colors hover:border-accent disabled:opacity-40 sm:px-2 sm:py-1 sm:text-xs sm:tracking-widest">
                  +{buyInUnit.toLocaleString()}
                </button>
                <button onClick={() => onCashOut(participant)} disabled={pending}
                  className="min-w-[4.75rem] shrink-0 border border-amber-400/40 px-1.5 py-1.5 text-[10px] tracking-wide text-amber-400 transition-colors hover:border-amber-400 disabled:opacity-40 sm:px-2 sm:py-1 sm:text-xs sm:tracking-widest">
                  CASH OUT
                </button>
                <button onClick={() => onRemove(participant)} disabled={pending}
                  className="shrink-0 px-0.5 text-xs text-muted transition-colors hover:text-danger disabled:opacity-40 sm:px-1 sm:text-sm" aria-label="remove player">
                  ✕
                </button>
              </div>
            )}
          </div>
        )}

        {interactive && expanded.has(participant.player_id) && (
          <div className="border-t border-border px-3 py-2 bg-surface/50">
            {cashedOut && (
              <div className="mb-2 flex min-w-0 items-baseline gap-2 overflow-hidden text-[10px] text-muted">
                <span className="shrink-0 tracking-widest">
                  CASHED OUT {new Date(participant.settled_at!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="min-w-0 truncate">
                  · BUY-IN <span className="text-white tabular-nums">{participant.total_buyin.toLocaleString()}</span>
                  {' · '}FINAL <span className="text-white tabular-nums">{finalChips.toLocaleString()}</span>
                </span>
              </div>
            )}
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
