import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import * as jsx from 'react/jsx-runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiClientError } from './client'
import type { LiveParticipant } from './queries'

const save = vi.fn()
const join = vi.fn()
const states: unknown[] = []
let cursor = 0
function useState<T>(initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const index = cursor++
  if (index >= states.length) states[index] = initial
  return [states[index] as T, next => { states[index] = typeof next === 'function' ? (next as (prev: T) => T)(states[index] as T) : next }]
}
function useRef<T>(initial: T) { return useState({ current: initial })[0] }
type Props = {
  open: boolean; groupId: string; sessionId: string; participants: LiveParticipant[]; unit: number
  mode?: 'buy-in' | 'join' | 'draft' | 'group'; onAddPlayers?: (ids: string[]) => Promise<void>; onAddDraft?: (ids: string[], amount: number) => void; onCreatePlayer?: (name: string) => Promise<Pick<LiveParticipant, 'player_id' | 'name' | 'settled_at'>>
  onClose: () => void; onSaved: () => void
}
type HostProps = {
  children?: ReactNode; id?: string; type?: string; disabled?: boolean; checked?: boolean; value?: string
  onClick?: () => void; onChange?: (event: { target: { value: string } }) => void
  onSubmit?: (event: { preventDefault: () => void }) => Promise<void>
  onCancel?: (event: { preventDefault: () => void }) => void
}
function nodes(node: ReactNode): ReactElement<HostProps>[] {
  const result: ReactElement<HostProps>[] = []
  Children.forEach(node, child => {
    if (!isValidElement<HostProps>(child)) return
    result.push(child); result.push(...nodes(child.props.children))
  })
  return result
}
function text(node: ReactNode): string {
  let result = ''
  Children.forEach(node, child => {
    if (typeof child === 'string' || typeof child === 'number') result += child
    else if (isValidElement<HostProps>(child)) result += text(child.props.children)
  })
  return result
}
function mount(mode: 'buy-in' | 'join' | 'draft' | 'group' = 'buy-in') {
  const source = readFileSync(new URL('../components/BuyInModal.tsx', import.meta.url), 'utf8')
  const output = transformSync(source, { format: 'cjs', jsx: 'automatic', loader: 'tsx' }).code
  const module = { exports: {} as Record<string, unknown> }
  const mocks: Record<string, unknown> = { react: { useState, useRef, useEffect: () => undefined }, 'react/jsx-runtime': jsx, '@/lib/client': { addBatchBuyIn: save, addBatchSessionParticipants: join, ApiClientError } }
  Function('require', 'module', 'exports', output)((name: string) => mocks[name], module, module.exports)
  const Component = module.exports.default as (props: Props) => ReactNode
  const participants = ['Alice', 'Bob', 'Carol'].map((name, i): LiveParticipant => ({
    name, player_id: name, total_buyin: 2000, buy_ins: [], final_chips: i === 2 ? 2000 : null, settled_at: i === 2 ? '2026-09-06T00:00:00Z' : null,
  }))
  const props: Props = { open: true, groupId: 'g1', sessionId: 's1', participants, unit: 2000, mode, onClose: vi.fn(), onSaved: vi.fn() }
  const render = () => { cursor = 0; return Component(props) }
  function choose(name: string) {
    const label = nodes(render()).find(n => n.type === 'label' && text(n).startsWith(name))!
    const checkbox = nodes(label).find(n => n.props.type === 'checkbox')!
    expect(checkbox.props.disabled).toBe(false)
    checkbox.props.onChange!({ target: { value: '' } })
  }
  const change = (id: string, value: string) => nodes(render()).find(n => n.props.id === id)!.props.onChange!({ target: { value } })
  const submit = () => nodes(render()).find(n => n.type === 'form')!.props.onSubmit!({ preventDefault() {} })
  return { render, props, choose, change, submit }
}
beforeEach(() => { states.length = 0; cursor = 0; save.mockReset(); join.mockReset() })

describe('BuyInModal interactions', () => {
  it('adds group members without chip inputs, buy-in requests, or a receipt', async () => {
    const app = mount('group'); app.props.onAddPlayers = vi.fn().mockResolvedValue(undefined)
    expect(nodes(app.render()).find(n => n.props.id === 'join-player-search')).toBeDefined()
    expect(nodes(app.render()).filter(n => n.props.type === 'number')).toHaveLength(0)
    expect(text(app.render())).not.toContain('CHIPS PER PLAYER')
    app.choose('Alice'); app.choose('Bob'); await app.submit()
    expect(app.props.onAddPlayers).toHaveBeenCalledExactlyOnceWith(['Alice', 'Bob'])
    expect(save).not.toHaveBeenCalled(); expect(join).not.toHaveBeenCalled()
    expect(app.props.onClose).toHaveBeenCalledOnce()
    expect(text(app.render())).not.toContain('Saved.')
  })
  it('keeps group errors and selections in the modal for retry', async () => {
    const app = mount('group')
    app.props.onAddPlayers = vi.fn().mockRejectedValueOnce(new Error('Could not add player')).mockResolvedValueOnce(undefined)
    app.choose('Alice'); await app.submit()
    expect(app.props.onClose).not.toHaveBeenCalled()
    expect(text(app.render())).toContain('Could not add player')
    expect(nodes(app.render()).filter(n => n.props.checked)).toHaveLength(1)
    await app.submit()
    expect(app.props.onClose).toHaveBeenCalledOnce()
    expect(save).not.toHaveBeenCalled(); expect(join).not.toHaveBeenCalled()
  })
  it('stages draft players with a custom amount without saving buy-ins or showing a receipt', async () => {
    const app = mount('draft'); app.props.onAddDraft = vi.fn()
    expect(nodes(app.render()).find(n => n.props.id === 'join-player-search')).toBeDefined()
    app.choose('Alice'); app.choose('Bob'); app.change('join-buy-in-amount', '3500')
    await app.submit()
    expect(app.props.onAddDraft).toHaveBeenCalledExactlyOnceWith(['Alice', 'Bob'], 3500)
    expect(save).not.toHaveBeenCalled(); expect(join).not.toHaveBeenCalled()
    expect(app.props.onSaved).not.toHaveBeenCalled()
    expect(app.props.onClose).toHaveBeenCalledOnce()
    expect(text(app.render())).not.toContain('Saved.')
    expect(nodes(app.render()).filter(n => n.props.checked)).toHaveLength(0)
  })
  it('always shows search for adding players, even with fewer than 10 candidates', () => {
    const app = mount('join')
    expect(nodes(app.render()).find(n => n.props.id === 'join-player-search')).toBeDefined()
    app.props.mode = 'buy-in'
    expect(nodes(app.render()).find(n => n.props.id === 'join-player-search')).toBeUndefined()
  })
  it('searches beyond the expanded page and preserves selections and expansion after clearing', () => {
    const app = mount('join')
    app.props.participants = Array.from({ length: 25 }, (_, i) => ({
      ...app.props.participants[0], player_id: `player-${i}`, name: `Player ${i}`, settled_at: null,
    }))
    const checkboxes = () => nodes(app.render()).filter(n => n.props.type === 'checkbox')
    const more = () => nodes(app.render()).find(n => n.type === 'button' && text(n) === '…')
    app.choose('Player 0'); more()!.props.onClick!()
    app.change('join-player-search', ' PLAYER 24 ')
    expect(checkboxes()).toHaveLength(1); expect(more()).toBeUndefined()
    app.choose('Player 24'); app.change('join-player-search', '')
    expect(checkboxes()).toHaveLength(20)
    expect(checkboxes().filter(n => n.props.checked)).toHaveLength(1)
    more()!.props.onClick!()
    expect(checkboxes().filter(n => n.props.checked)).toHaveLength(2)
  })
  it('prefills new player creation from an unmatched search without creating automatically', () => {
    const app = mount('join'); app.props.onCreatePlayer = vi.fn()
    app.change('join-player-search', ' Dave ')
    expect(text(app.render())).toContain('No matching players.')
    nodes(app.render()).find(n => n.type === 'button' && text(n) === '+ NEW PLAYER')!.props.onClick!()
    expect(nodes(app.render()).find(n => n.props.id === 'join-new-player-name')!.props.value).toBe('Dave')
    expect(app.props.onCreatePlayer).not.toHaveBeenCalled()
  })
  it('reveals 10 more join candidates at a time, preserves choices, and resets on close', () => {
    const app = mount('join')
    app.props.participants = Array.from({ length: 25 }, (_, i) => ({
      ...app.props.participants[0], player_id: `player-${i}`, name: `Player ${i}`, settled_at: null,
    }))
    const checkboxes = () => nodes(app.render()).filter(n => n.props.type === 'checkbox')
    const more = () => nodes(app.render()).find(n => n.type === 'button' && text(n) === '…')
    expect(checkboxes()).toHaveLength(10)
    app.choose('Player 0'); more()!.props.onClick!()
    expect(checkboxes()).toHaveLength(20)
    app.choose('Player 15'); more()!.props.onClick!()
    expect(checkboxes()).toHaveLength(25)
    expect(checkboxes().filter(n => n.props.checked)).toHaveLength(2)
    expect(more()).toBeUndefined()
    nodes(app.render()).find(n => n.type === 'dialog')!.props.onCancel!({ preventDefault() {} })
    expect(checkboxes()).toHaveLength(10)
    expect(checkboxes().filter(n => n.props.checked)).toHaveLength(0)
  })
  it('continues showing all existing-session players in the buy-in picker', () => {
    const app = mount()
    app.props.participants = Array.from({ length: 15 }, (_, i) => ({ ...app.props.participants[0], player_id: String(i), name: `P${i}` }))
    expect(nodes(app.render()).filter(n => n.props.type === 'checkbox')).toHaveLength(15)
    expect(nodes(app.render()).find(n => n.type === 'button' && text(n) === '…')).toBeUndefined()
  })
  it('creates a player inline, selects them, and preserves the existing selection and amount', async () => {
    const app = mount('join')
    app.props.onCreatePlayer = vi.fn(async name => {
      const player = { ...app.props.participants[0], player_id: 'new-player', name }
      app.props.participants = [...app.props.participants, player]
      return player
    })
    app.choose('Alice'); app.change('join-buy-in-amount', '3500')
    nodes(app.render()).find(n => n.type === 'button' && text(n) === '+ NEW PLAYER')!.props.onClick!()
    app.change('join-new-player-name', ' Dave ')
    expect(nodes(app.render()).find(n => n.props.type === 'submit')!.props.disabled).toBe(true)
    nodes(app.render()).find(n => n.type === 'button' && text(n) === 'CREATE')!.props.onClick!()
    await vi.waitFor(() => expect(nodes(app.render()).filter(n => n.props.type === 'checkbox' && n.props.checked)).toHaveLength(2))
    expect(app.props.onCreatePlayer).toHaveBeenCalledExactlyOnceWith('Dave')
    expect(app.props.onClose).not.toHaveBeenCalled()
    expect(join).not.toHaveBeenCalled()
    join.mockResolvedValue({ count: 2 }); await app.submit()
    expect(join.mock.calls[0][2]).toMatchObject({ amount: 3500, entries: [{ player_id: 'Alice' }, { player_id: 'new-player' }] })
  })
  it('cancels inline creation without losing selected players or creating a player', () => {
    const app = mount('join'); app.props.onCreatePlayer = vi.fn()
    app.choose('Alice')
    nodes(app.render()).find(n => n.type === 'button' && text(n) === '+ NEW PLAYER')!.props.onClick!()
    app.change('join-new-player-name', 'Draft')
    nodes(app.render()).find(n => n.type === 'button' && text(n) === 'CANCEL')!.props.onClick!()
    expect(app.props.onCreatePlayer).not.toHaveBeenCalled()
    expect(nodes(app.render()).filter(n => n.props.type === 'checkbox' && n.props.checked)).toHaveLength(1)
    expect(nodes(app.render()).find(n => n.props.id === 'join-new-player-name')).toBeUndefined()
  })
  it('keeps inline creation errors in the dialog without joining players', async () => {
    const app = mount('join'); app.props.onCreatePlayer = vi.fn().mockRejectedValue(new Error('Could not create player'))
    nodes(app.render()).find(n => n.type === 'button' && text(n) === '+ NEW PLAYER')!.props.onClick!()
    app.change('join-new-player-name', 'Dave')
    nodes(app.render()).find(n => n.type === 'button' && text(n) === 'CREATE')!.props.onClick!()
    await vi.waitFor(() => expect(text(app.render())).toContain('Could not create player'))
    expect(app.props.onClose).not.toHaveBeenCalled(); expect(join).not.toHaveBeenCalled()
  })
  it('adds multiple new participants using the default buy-in and the dedicated join endpoint', async () => {
    join.mockResolvedValue({ count: 2 })
    const app = mount('join'); app.choose('Alice'); app.choose('Bob')
    await app.submit()
    expect(join).toHaveBeenCalledWith('g1', 's1', expect.objectContaining({ amount: 2000, entries: [
      { id: expect.any(String), player_id: 'Alice' }, { id: expect.any(String), player_id: 'Bob' },
    ] }))
    expect(save).not.toHaveBeenCalled()
    expect(text(app.render())).toContain('Alice+2,000')
  })
  it('applies custom initial buy-ins to each selected new participant', async () => {
    join.mockResolvedValue({ count: 2 })
    const app = mount('join'); app.choose('Alice'); app.choose('Bob')
    app.change('join-buy-in-amount', '3500'); await app.submit()
    expect(join.mock.calls[0][2].amount).toBe(3500)
    expect(text(app.render())).toContain('Bob+3,500')
  })
  it('uses the third default multiple for an initial buy-in', async () => {
    join.mockResolvedValue({ count: 1 })
    const app = mount('join'); app.choose('Alice')
    nodes(app.render()).find(n => n.type === 'button' && text(n) === '6,000')!.props.onClick!()
    await app.submit()
    expect(join.mock.calls[0][2].amount).toBe(6000)
  })
  it('allows multiple active session participants', () => {
    const app = mount()
    const carol = nodes(app.render()).find(n => n.type === 'label' && text(n).startsWith('Carol'))!
    expect(nodes(carol).find(n => n.props.type === 'checkbox')!.props.disabled).toBe(true)
    expect(text(app.render())).not.toContain('NEW PLAYER')
    app.choose('Alice'); app.choose('Bob')
    expect(nodes(app.render()).filter(n => n.props.type === 'checkbox' && n.props.checked)).toHaveLength(2)
  })
  it('requires a player and a positive integer amount', () => {
    const app = mount()
    const disabled = () => nodes(app.render()).find(n => n.props.type === 'submit')!.props.disabled
    expect(disabled()).toBe(true)
    app.choose('Alice')
    expect(disabled()).toBe(false)
    for (const value of ['', '0', '-1', '1.5', '2147483648']) { app.change('buy-in-amount', value); expect(disabled()).toBe(true) }
  })
  it('saves once despite repeated submit and shows a per-player receipt until DONE', async () => {
    let finish!: (value: unknown) => void
    save.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const app = mount(); app.choose('Alice'); app.choose('Bob'); app.change('buy-in-amount', '4000')
    const saving = app.submit(); await app.submit()
    expect(save).toHaveBeenCalledTimes(1)
    expect(save.mock.calls[0][2]).toMatchObject({ amount: 4000, entries: [{ player_id: 'Alice' }, { player_id: 'Bob' }] })
    finish({ count: 2 }); await saving
    expect(text(app.render())).toContain('Saved. Distribute chips as listed below.')
    expect(text(app.render())).toContain('Alice+4,000')
    expect(text(app.render())).toContain('Bob+4,000')
    expect(app.props.onClose).not.toHaveBeenCalled()
    nodes(app.render()).find(n => n.type === 'button' && text(n) === 'DONE')!.props.onClick!()
    expect(app.props.onClose).toHaveBeenCalledOnce()
    expect(nodes(app.render()).filter(n => n.props.type === 'checkbox' && n.props.checked)).toHaveLength(0)
  })
  it('retries the exact IDs after an uncertain response, including closing and reopening', async () => {
    save.mockRejectedValueOnce(new TypeError('Network error')).mockResolvedValueOnce({ count: 1 })
    const app = mount(); app.choose('Alice'); await app.submit()
    const first = save.mock.calls[0][2]
    expect(text(nodes(app.render()).find(n => n.props.type === 'submit'))).toBe('RETRY')
    nodes(app.render()).find(n => n.type === 'dialog')!.props.onCancel!({ preventDefault() {} })
    await app.submit()
    expect(save.mock.calls[1][2]).toEqual(first)
    expect(text(app.render())).toContain('Saved. Distribute chips as listed below.')
  })
  it('keeps selection editable after a definitive validation rejection', async () => {
    save.mockRejectedValueOnce(new ApiClientError(422, { error: 'Participant no longer in session' }))
    const app = mount(); app.choose('Alice'); await app.submit()
    expect(text(app.render())).toContain('Participant no longer in session')
    app.choose('Bob')
    expect(nodes(app.render()).filter(n => n.props.type === 'checkbox' && n.props.checked)).toHaveLength(2)
  })
})
