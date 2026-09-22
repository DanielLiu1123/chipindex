import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import BrowserTime from '@/components/BrowserTime'
import ChipValue from '@/components/ChipValue'
import type { LiveParticipant } from '@/lib/domain-types'
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
    return (
      <p className="text-muted-foreground text-xs tracking-normal py-6 text-center">
        NO PLAYERS YET — USE + PLAYER
      </p>
    )
  }

  return participants.map((participant) => {
    const cashedOut = isCashedOut(participant)
    const finalChips = participant.final_chips ?? 0
    const netChips = finalChips - participant.total_buyin
    const isExpanded = interactive && expanded.has(participant.player_id)
    const detailsToggle = (
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          type="button"
          disabled={!interactive}
          aria-label={`${participant.name} buy-in history`}
          aria-expanded={isExpanded}
          title={participant.name}
          className="min-w-0 flex-1 self-stretch text-left"
        >
          {interactive && (
            <ChevronRight
              aria-hidden="true"
              className={`size-3 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${isExpanded ? 'rotate-90' : ''}`}
            />
          )}
          <span className="min-w-0 flex-1 truncate text-sm leading-snug text-foreground sm:text-base">
            {participant.name}
          </span>
          {cashedOut ? (
            <span className="shrink-0 whitespace-nowrap text-[10px] tracking-normal text-muted-foreground sm:text-xs">
              NET{' '}
              <ChipValue
                chips={netChips}
                className="tracking-normal tabular-nums"
              />
            </span>
          ) : (
            <span className="shrink-0 whitespace-nowrap text-[11px] text-muted-foreground tabular-nums group-hover:text-foreground sm:text-xs">
              {participant.buy_ins.length}×{' '}
              <span className="text-foreground">
                {participant.total_buyin.toLocaleString()}
              </span>
            </span>
          )}
        </Button>
      </CollapsibleTrigger>
    )

    return (
      <Collapsible
        key={participant.player_id}
        open={isExpanded}
        onOpenChange={() => onToggle(participant.player_id)}
        className="rounded-lg border border-border"
      >
        {cashedOut ? (
          <div className="flex flex-nowrap items-center gap-1.5 px-3 py-1.5 sm:gap-2">
            {detailsToggle}
            {interactive && (
              <div className="contents">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => onUndoCashOut(participant.player_id)}
                  disabled={pending}
                  className="w-[4.75rem] shrink-0 sm:w-24"
                  aria-label={`undo ${participant.name} cash out`}
                >
                  UNDO
                </Button>
                <Button
                  variant="destructive"
                  type="button"
                  onClick={() => onRemove(participant)}
                  disabled={pending}
                  className="shrink-0"
                  aria-label="remove player"
                >
                  ✕
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-nowrap items-center gap-1.5 px-3 py-1.5 sm:gap-2">
            {detailsToggle}
            {interactive && (
              <div className="contents">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => onCashOut(participant)}
                  disabled={pending}
                  className="w-[4.75rem] shrink-0 text-xs sm:w-24"
                >
                  CASH OUT
                </Button>
                <Button
                  variant="destructive"
                  type="button"
                  onClick={() => onRemove(participant)}
                  disabled={pending}
                  className="shrink-0"
                  aria-label="remove player"
                >
                  ✕
                </Button>
              </div>
            )}
          </div>
        )}

        <CollapsibleContent className="border-t border-border px-3 py-2 bg-muted/50">
          {cashedOut && (
            <div className="mb-2 flex min-w-0 items-baseline gap-2 overflow-hidden text-[10px] text-muted-foreground">
              <span className="shrink-0 tracking-normal">
                CASHED OUT <BrowserTime value={participant.settled_at!} />
              </span>
              <span className="min-w-0 truncate">
                · BUY-IN{' '}
                <span className="text-foreground tabular-nums">
                  {participant.total_buyin.toLocaleString()}
                </span>
                {' · '}FINAL{' '}
                <span className="text-foreground tabular-nums">
                  {finalChips.toLocaleString()}
                </span>
              </span>
            </div>
          )}
          {participant.buy_ins.length > 0 && (
            <div className="flex flex-col gap-1 mb-2">
              {participant.buy_ins.map((buyIn) => (
                <div
                  key={buyIn.id}
                  className="flex items-center justify-between text-xs text-muted-foreground"
                >
                  <span>
                    <BrowserTime value={buyIn.created_at} /> · +
                    {buyIn.amount.toLocaleString()}
                  </span>
                  {!cashedOut && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      type="button"
                      onClick={() => onRevokeBuyIn(buyIn.id)}
                      disabled={pending}
                    >
                      ✕
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    )
  })
}
