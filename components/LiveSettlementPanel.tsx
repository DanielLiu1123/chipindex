import type { LiveParticipant } from '@/lib/queries'
import { isCashedOut, summarizeLiveSession } from '@/lib/live-session'

interface Props {
  participants: LiveParticipant[]
  finals: Readonly<Record<string, string>>
  buyInUnit: number
  pending: boolean
  settleError: { diff: number } | null
  onFinalChange: (playerId: string, value: string) => void
  onSubmit: (force: boolean) => void
  onCancel: () => void
}

export default function LiveSettlementPanel({ participants, finals, buyInUnit, pending, settleError, onFinalChange, onSubmit, onCancel }: Props) {
  const { pot, totalFinal, settleDiff, allFinalsFilled } = summarizeLiveSession(participants, finals)

  return (
    <div className="border border-border p-4">
      <p className="text-xs text-muted tracking-widest mb-1">FINAL CHIPS</p>
      <p className="text-xs text-muted mb-4">Enter final chips for active players. Cashed-out players are already locked.</p>
      <div className="flex flex-col gap-2 mb-4">
        {participants.map(participant => (
          <div key={participant.player_id} className="flex items-center gap-3">
            <span className="flex-1 flex items-baseline gap-2 min-w-0">
              <span className="text-white text-sm truncate">{participant.name}</span>
              {isCashedOut(participant) && <span className="shrink-0 text-[10px] text-muted tracking-widest">CASHED OUT</span>}
            </span>
            <span className="text-xs text-muted">buy-in {participant.total_buyin.toLocaleString()}</span>
            {isCashedOut(participant) ? (
              <div className="w-28 border border-transparent px-3 py-2 text-right">
                <span className="text-sm text-white tabular-nums">{(participant.final_chips ?? 0).toLocaleString()}</span>
              </div>
            ) : (
              <input type="number" inputMode="numeric" min="0" value={finals[participant.player_id] ?? ''}
                onChange={event => onFinalChange(participant.player_id, event.target.value)}
                placeholder="final"
                className="w-28 bg-surface border border-border text-white text-sm px-3 py-2 outline-none focus:border-white transition-colors placeholder:text-muted text-right" />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs tracking-widest border-t border-border pt-3 mb-4">
        <span className="text-muted">Σ FINAL / POT</span>
        <span className={settleDiff === 0 ? 'text-accent' : 'text-amber-400'}>
          {totalFinal.toLocaleString()} / {pot.toLocaleString()}
          {settleDiff !== 0 && (
            <span className="ml-2">diff {settleDiff > 0 ? '+' : ''}{settleDiff.toLocaleString()}
              {settleDiff % buyInUnit === 0 && ` (= ${settleDiff / buyInUnit}×${buyInUnit})`}
            </span>
          )}
        </span>
      </div>

      {settleError && (
        <div className="mb-4 text-xs text-amber-400">
          Not balanced — diff {settleError.diff > 0 ? '+' : ''}{settleError.diff.toLocaleString()}.
          Double-check everyone&apos;s final chips; if correct, you can force settle (this session will keep an unbalanced record).
          <button onClick={() => onSubmit(true)} disabled={pending}
            className="block mt-2 text-danger tracking-widest hover:underline disabled:opacity-40">FORCE SETTLE →</button>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={() => onSubmit(false)} disabled={pending || !allFinalsFilled}
          className="flex-1 bg-white text-bg text-xs font-medium tracking-widest py-3 hover:bg-accent transition-colors disabled:opacity-40">
          {pending ? 'SETTLING...' : 'CONFIRM SETTLE'}
        </button>
        <button onClick={onCancel} disabled={pending}
          className="text-xs text-muted tracking-widest px-4 hover:text-white transition-colors disabled:opacity-40">CANCEL</button>
      </div>
    </div>
  )
}
