'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import PlayerSelect from '@/components/PlayerSelect'
import ConfirmModal from '@/components/ConfirmModal'
import type { Player } from '@/types'
import type { LiveSessionData, LiveParticipant } from '@/lib/queries'

export default function LiveSession({ session, allPlayers }: { session: LiveSessionData; allPlayers: Player[] }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [custom, setCustom] = useState<Record<string, string>>({})
  const [addId, setAddId] = useState('')
  const [newName, setNewName] = useState('')
  const [addingNew, setAddingNew] = useState(false)
  const [settling, setSettling] = useState(false)
  const [finals, setFinals] = useState<Record<string, string>>({})
  const [settleError, setSettleError] = useState<{ diff: number } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<LiveParticipant | null>(null)
  const [error, setError] = useState('')

  const unit = session.buy_in_unit
  const pot = session.participants.reduce((s, p) => s + p.total_buyin, 0)
  const usedIds = session.participants.map(p => p.player_id)
  const availablePlayers = allPlayers.filter(p => !usedIds.includes(p.id))

  async function act(fn: () => Promise<Response>) {
    setPending(true)
    setError('')
    try {
      const res = await fn()
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Request failed')
      }
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setPending(false)
    }
  }

  const addBuyIn = (player_id: string, amount: number) =>
    act(() => fetch(`/api/sessions/${session.id}/buyin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id, amount }),
    }))

  const undoBuyIn = (buyinId: string) =>
    act(() => fetch(`/api/sessions/${session.id}/buyin/${buyinId}`, { method: 'DELETE' }))

  const removeParticipant = (player_id: string) =>
    act(() => fetch(`/api/sessions/${session.id}/participant`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id }),
    }))

  async function doRemove() {
    if (!confirmRemove) return
    const pid = confirmRemove.player_id
    setConfirmRemove(null)
    await removeParticipant(pid)
  }

  function addCustom(player_id: string) {
    const v = Number(custom[player_id])
    if (!Number.isInteger(v) || v <= 0) return
    setCustom(c => ({ ...c, [player_id]: '' }))
    addBuyIn(player_id, v)
  }

  async function addExisting(player_id: string) {
    // 加入即给一笔初始买入（= buy_in_unit），participant 由买入接口懒创建
    await act(() => fetch(`/api/sessions/${session.id}/buyin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id, amount: unit }),
    }))
    setAddId('')
  }

  async function addNewPlayer() {
    const name = newName.trim()
    if (!name) return
    setPending(true)
    setError('')
    try {
      const res = await fetch('/api/players', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      const p = await res.json()
      await fetch(`/api/sessions/${session.id}/buyin`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: p.id, amount: unit }),
      })
      setNewName('')
      setAddingNew(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setPending(false)
    }
  }

  function toggleExpand(player_id: string) {
    setExpanded(s => {
      const next = new Set(s)
      if (next.has(player_id)) next.delete(player_id)
      else next.add(player_id)
      return next
    })
  }

  // ── 结算 ──────────────────────────────────────────────
  const totalFinal = session.participants.reduce((s, p) => s + (Number(finals[p.player_id]) || 0), 0)
  const settleDiff = totalFinal - pot
  const allFinalsFilled = session.participants.every(p => finals[p.player_id] !== undefined && finals[p.player_id] !== '')

  async function submitSettle(force: boolean) {
    setPending(true)
    setError('')
    setSettleError(null)
    try {
      const res = await fetch(`/api/sessions/${session.id}/settle`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          finals: session.participants.map(p => ({ player_id: p.player_id, final_chips: Number(finals[p.player_id]) })),
          force,
        }),
      })
      if (res.status === 422) {
        const body = await res.json()
        setSettleError({ diff: body.diff })
        setPending(false)
        return
      }
      if (!res.ok) throw new Error((await res.json()).error ?? 'Settle failed')
      router.push(`/sessions/${session.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Settle failed')
      setPending(false)
    }
  }

  return (
    <>
      <ConfirmModal
        open={confirmRemove !== null}
        title={confirmRemove ? `Remove ${confirmRemove.name}?` : ''}
        description={confirmRemove ? `This will delete their ${confirmRemove.buy_ins.length} buy-in(s) (${confirmRemove.total_buyin.toLocaleString()} chips).` : undefined}
        confirmLabel="REMOVE"
        onConfirm={doRemove}
        onCancel={() => setConfirmRemove(null)}
      />
      <div className="mb-6">
        <Link href="/sessions" className="text-muted text-xs hover:text-white tracking-widest">← SESSIONS</Link>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
        <span className="text-xs text-accent tracking-widest">LIVE</span>
        <span className="text-white">{session.date}</span>
        {session.description && <span className="text-sm text-muted">· {session.description}</span>}
      </div>
      <div className="mb-6 flex items-baseline gap-2">
        <span className="text-xs text-muted tracking-widest">POT (TOTAL BUY-IN)</span>
        <span className="text-accent text-lg">{pot.toLocaleString()}</span>
        <span className="text-xs text-muted">chips</span>
      </div>

      {error && <p className="text-danger text-xs mb-4">{error}</p>}

      {/* 参与者 + 买入 */}
      <div className="flex flex-col gap-1 mb-6">
        {session.participants.length === 0 && (
          <p className="text-muted text-xs tracking-widest py-6 text-center">NO PLAYERS YET — ADD SOMEONE BELOW</p>
        )}
        {session.participants.map(p => (
          <div key={p.player_id} className="border border-border">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <button onClick={() => toggleExpand(p.player_id)} className="flex-1 text-left flex items-baseline gap-2 min-w-0">
                <span className="text-white truncate">{p.name}</span>
                <span className="text-xs text-muted">{p.buy_ins.length}×</span>
              </button>
              <span className="text-sm text-white tabular-nums">{p.total_buyin.toLocaleString()}</span>
              {!settling && (
                <>
                  <button onClick={() => addBuyIn(p.player_id, unit)} disabled={pending}
                    className="text-xs text-accent border border-accent/40 hover:border-accent px-2 py-1 tracking-widest transition-colors disabled:opacity-40">
                    +{unit.toLocaleString()}
                  </button>
                  <button onClick={() => setConfirmRemove(p)} disabled={pending}
                    className="text-muted hover:text-danger text-sm px-1 transition-colors disabled:opacity-40" aria-label="remove player">
                    ✕
                  </button>
                </>
              )}
            </div>

            {expanded.has(p.player_id) && !settling && (
              <div className="border-t border-border px-3 py-2 bg-surface/50">
                {p.buy_ins.length > 0 && (
                  <div className="flex flex-col gap-1 mb-2">
                    {p.buy_ins.map(b => (
                      <div key={b.id} className="flex items-center justify-between text-xs text-muted">
                        <span>{new Date(b.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · +{b.amount.toLocaleString()}</span>
                        <button onClick={() => undoBuyIn(b.id)} disabled={pending}
                          className="hover:text-danger transition-colors px-1">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input type="number" inputMode="numeric" value={custom[p.player_id] ?? ''} min="1"
                    onChange={e => setCustom(c => ({ ...c, [p.player_id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter') addCustom(p.player_id) }}
                    placeholder="custom amount"
                    className="flex-1 bg-surface border border-border text-white text-xs px-3 py-2 outline-none focus:border-white transition-colors placeholder:text-muted" />
                  <button onClick={() => addCustom(p.player_id)} disabled={pending}
                    className="text-xs text-accent tracking-widest px-2 py-2 hover:underline disabled:opacity-40">ADD</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 加入玩家 */}
      {!settling && (
        <div className="mb-8">
          {addingNew ? (
            <div className="flex gap-2 items-center">
              <input type="text" value={newName} autoFocus
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addNewPlayer() }}
                placeholder="new player name"
                className="flex-1 bg-surface border border-accent text-white text-sm px-4 py-2.5 outline-none focus:border-white transition-colors placeholder:text-muted" />
              <button onClick={addNewPlayer} disabled={pending}
                className="text-xs text-accent tracking-widest px-3 py-2.5 hover:underline disabled:opacity-40">ADD</button>
              <button onClick={() => { setAddingNew(false); setNewName('') }}
                className="text-xs text-muted tracking-widest px-2 py-2.5 hover:text-white transition-colors">✕</button>
            </div>
          ) : (
            <PlayerSelect
              value={addId}
              players={availablePlayers}
              onChange={val => val === '__new__' ? setAddingNew(true) : addExisting(val)}
            />
          )}
        </div>
      )}

      {/* 结算 */}
      {!settling ? (
        <button onClick={() => setSettling(true)} disabled={pending || session.participants.length === 0}
          className="w-full bg-white text-bg text-xs font-medium tracking-widest py-3 hover:bg-accent transition-colors disabled:opacity-40">
          SETTLE SESSION
        </button>
      ) : (
        <div className="border border-border p-4">
          <p className="text-xs text-muted tracking-widest mb-4">FINAL CHIPS — each player counts their own stack</p>
          <div className="flex flex-col gap-2 mb-4">
            {session.participants.map(p => (
              <div key={p.player_id} className="flex items-center gap-3">
                <span className="flex-1 text-white text-sm truncate">{p.name}</span>
                <span className="text-xs text-muted">buy-in {p.total_buyin.toLocaleString()}</span>
                <input type="number" inputMode="numeric" min="0" value={finals[p.player_id] ?? ''}
                  onChange={e => setFinals(f => ({ ...f, [p.player_id]: e.target.value }))}
                  placeholder="final"
                  className="w-28 bg-surface border border-border text-white text-sm px-3 py-2 outline-none focus:border-white transition-colors placeholder:text-muted text-right" />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs tracking-widest border-t border-border pt-3 mb-4">
            <span className="text-muted">Σ FINAL / POT</span>
            <span className={settleDiff === 0 ? 'text-accent' : 'text-amber-400'}>
              {totalFinal.toLocaleString()} / {pot.toLocaleString()}
              {settleDiff !== 0 && (
                <span className="ml-2">diff {settleDiff > 0 ? '+' : ''}{settleDiff.toLocaleString()}
                  {settleDiff % unit === 0 && ` (= ${settleDiff / unit}×${unit})`}
                </span>
              )}
            </span>
          </div>

          {settleError && (
            <div className="mb-4 text-xs text-amber-400">
              Not balanced — diff {settleError.diff > 0 ? '+' : ''}{settleError.diff.toLocaleString()}.
              Double-check everyone&apos;s final chips; if correct, you can force settle (this session will keep an unbalanced record).
              <button onClick={() => submitSettle(true)} disabled={pending}
                className="block mt-2 text-danger tracking-widest hover:underline disabled:opacity-40">
                FORCE SETTLE →
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => submitSettle(false)} disabled={pending || !allFinalsFilled}
              className="flex-1 bg-white text-bg text-xs font-medium tracking-widest py-3 hover:bg-accent transition-colors disabled:opacity-40">
              {pending ? 'SETTLING...' : 'CONFIRM SETTLE'}
            </button>
            <button onClick={() => { setSettling(false); setSettleError(null) }} disabled={pending}
              className="text-xs text-muted tracking-widest px-4 hover:text-white transition-colors disabled:opacity-40">
              CANCEL
            </button>
          </div>
        </div>
      )}
    </>
  )
}
