import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { LiveParticipant } from '@/lib/domain-types'
import { isCashedOut, summarizeLiveSession } from '@/lib/live-session'

interface Props {
  participants: LiveParticipant[]
  finals: Readonly<Record<string, string>>
  pending: boolean
  settleError: { diff: number } | null
  onFinalChange: (playerId: string, value: string) => void
  onSubmit: (force: boolean) => void
  onCancel: () => void
}

export default function LiveSettlementPanel({ participants, finals, pending, settleError, onFinalChange, onSubmit, onCancel }: Props) {
  const { pot, totalFinal, settleDiff, allFinalsFilled } = summarizeLiveSession(participants, finals)

  return (
    <div className="border border-border p-4">
      <div className="flex flex-col gap-2 mb-4">
        {participants.map(participant => (
          <div key={participant.player_id} className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{participant.name}</span>
            <span className="text-xs text-muted-foreground">buy-in {participant.total_buyin.toLocaleString()}</span>
            {isCashedOut(participant) ? (
              <div className="w-20 border border-transparent px-2 py-2 text-right sm:w-28 sm:px-3">
                <span className="text-sm text-foreground tabular-nums">{(participant.final_chips ?? 0).toLocaleString()}</span>
              </div>
            ) : (
              <Input aria-label={`final chips for ${participant.name}`} disabled={pending} type="number" inputMode="numeric" min="0" value={finals[participant.player_id] ?? ''}
                onChange={event => onFinalChange(participant.player_id, event.target.value)}
                placeholder="final"
                className="w-20 text-right sm:w-28" />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs tracking-normal border-t border-border pt-3 mb-4">
        <span className="text-muted-foreground">Σ FINAL / POT</span>
        <span className={settleDiff === 0 ? 'text-primary' : 'text-amber-700 dark:text-amber-400'}>
          {totalFinal.toLocaleString()} / {pot.toLocaleString()}
          {settleDiff !== 0 && (
            <span className="ml-2">diff {settleDiff > 0 ? '+' : ''}{settleDiff.toLocaleString()}
            </span>
          )}
        </span>
      </div>

      {settleError && (
        <div className="mb-4 text-xs text-amber-700 dark:text-amber-400">
          Not balanced — diff {settleError.diff > 0 ? '+' : ''}{settleError.diff.toLocaleString()}.
          Double-check everyone&apos;s final chips; if correct, you can force settle (this session will keep an unbalanced record).
          <Button variant="destructive" type="button" onClick={() => onSubmit(true)} disabled={pending}
            className="mt-2">FORCE SETTLE →</Button>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="default" type="button" onClick={() => onSubmit(false)} disabled={pending || !allFinalsFilled}
          className="flex-1">
          {pending ? 'SETTLING...' : 'CONFIRM SETTLE'}
        </Button>
        <Button variant="ghost" type="button" onClick={onCancel} disabled={pending}
          >CANCEL</Button>
      </div>
    </div>
  )
}
