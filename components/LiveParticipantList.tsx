import ChipValue from '@/components/ChipValue'
import type { LiveParticipant } from '@/lib/queries'
import { isCashedOut } from '@/lib/live-session'

interface Props {
  participants: LiveParticipant[]
  expanded: ReadonlySet<string>
  pending: boolean
  interactive: boolean
  onToggle: (playerId: string) => void
  onRevokeBuyIn: (buyInId: string) => void
  onCashOut: (participant: LiveParticipant) => void
  onUndoCashOut: (playerId: string) => void
  onRemove: (participant: LiveParticipant) => void
}

export default function LiveParticipantList({
  participants,
  expanded,
  pending,
  interactive,
  onToggle,
  onRevokeBuyIn,
  onCashOut,
  onUndoCashOut,
  onRemove,
}: Props) {
  if (participants.length === 0) {
    return <p className="text-muted text-xs tracking-widest py-6 text-center">NO PLAYERS YET — ADD SOMEONE BELOW</p>
  }

  return participants.map(participant => {
    const cashedOut = isCashedOut(participant)
    const finalChips = participant.final_chips ?? 0
    const netChips = finalChips - participant.total_buyin
    const isExpanded = interactive && expanded.has(participant.player_id)
    const detailsToggle = (
      <button type="button" onClick={() => onToggle(participant.player_id)} disabled={!interactive}
        aria-label={`${participant.name} buy-in history`} aria-expanded={isExpanded}
        title={participant.name}
        className="group flex min-w-0 flex-1 self-stretch items-center gap-2 text-left">
        {interactive && <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"
          className={`h-3 w-3 shrink-0 text-muted transition-transform group-hover:text-white motion-reduce:transition-none ${isExpanded ? 'rotate-90' : ''}`}>
          <path d="m6 3 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>}
        <span className="min-w-0 flex-1 truncate text-sm leading-snug text-white sm:text-base">{participant.name}</span>
        {cashedOut ? (
          <span className="shrink-0 whitespace-nowrap text-[10px] tracking-widest text-muted sm:text-xs">
            NET <ChipValue chips={netChips} className="tracking-normal tabular-nums" />
          </span>
        ) : (
          <span className="shrink-0 whitespace-nowrap text-[11px] text-muted tabular-nums group-hover:text-white sm:text-xs">
            {participant.buy_ins.length}× <span className="text-white">{participant.total_buyin.toLocaleString()}</span>
          </span>
        )}
      </button>
    )

    return (
      <div key={participant.player_id} className="border border-border">
        {cashedOut ? (
          <div className="flex flex-nowrap items-center gap-1.5 px-3 py-1.5 sm:gap-2">
            {detailsToggle}
            {interactive && (
              <div className="contents">
                <button onClick={() => onUndoCashOut(participant.player_id)} disabled={pending}
                  className="w-[4.75rem] shrink-0 border border-sky-400/40 px-1.5 py-1.5 text-[10px] tracking-wide text-sky-400 transition-colors hover:border-sky-400 disabled:opacity-40 sm:w-24 sm:px-2 sm:py-1 sm:text-xs sm:tracking-widest"
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
          <div className="flex flex-nowrap items-center gap-1.5 px-3 py-1.5 sm:gap-2">
            {detailsToggle}
            {interactive && (
              <div className="contents">
                <button onClick={() => onCashOut(participant)} disabled={pending}
                  className="w-[4.75rem] shrink-0 border border-amber-400/40 px-1.5 py-1.5 text-[10px] tracking-wide text-amber-400 transition-colors hover:border-amber-400 disabled:opacity-40 sm:w-24 sm:px-2 sm:py-1 sm:text-xs sm:tracking-widest">
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
          </div>
        )}
      </div>
    )
  })
}
