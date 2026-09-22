// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useState, type ComponentProps } from 'react'
import PlayerSelectionModal from '../components/PlayerSelectionModal'
import BuyInModal from '../components/BuyInModal'
import {
  ApiClientError,
  addBatchBuyIn,
  addBatchSessionParticipants,
} from './client'
import type { SelectablePlayer } from './player-selection'
vi.mock('./client', async (original) => ({
  ...(await original<typeof import('./client')>()),
  addBatchBuyIn: vi.fn(),
  addBatchSessionParticipants: vi.fn(),
}))
const save = vi.mocked(addBatchBuyIn)
const join = vi.mocked(addBatchSessionParticipants)
type Mode = 'buy-in' | 'join' | 'draft' | 'group'
const players: SelectablePlayer[] = ['Alice', 'Bob', 'Carol'].map((name) => ({
  name,
  player_id: name,
  settled_at: name === 'Carol' ? '2026-09-06' : null,
}))
const button = (name: string) =>
  screen.getByRole('button', { name }) as HTMLButtonElement
const choose = (name: string) =>
  fireEvent.click(screen.getByRole('checkbox', { name }))
const selected = () => screen.queryAllByRole('checkbox', { checked: true })
const changeAmount = (value: string) =>
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value } })
const submitButton = () =>
  screen
    .getByRole('dialog')
    .querySelector<HTMLButtonElement>('button[type="submit"]')!
const submit = async () => {
  await act(async () => {
    fireEvent.submit(submitButton().form!)
  })
}
const createName = (value: string) =>
  fireEvent.change(screen.getByRole('textbox', { name: 'New player name' }), {
    target: { value },
  })
const search = (value: string) =>
  fireEvent.change(screen.getByRole('searchbox'), { target: { value } })
function mount(
  mode: Mode = 'buy-in',
  candidates = players,
  create?: ComponentProps<typeof PlayerSelectionModal>['onCreatePlayer'],
) {
  const onClose = vi.fn(),
    onSaved = vi.fn(),
    onAddPlayers = vi
      .fn<(...args: [string[]]) => Promise<void>>()
      .mockResolvedValue(undefined),
    onAddDraft = vi.fn()
  let setOpen!: (open: boolean) => void
  const callbacks = { onClose, onSaved, onAddPlayers, onAddDraft }
  function App({
    participants,
    createPlayer,
  }: {
    participants: SelectablePlayer[]
    createPlayer?: typeof create
  }) {
    const [open, updateOpen] = useState(true)
    setOpen = updateOpen
    const close = () => {
      onClose()
      updateOpen(false)
    }
    if (mode === 'buy-in' || mode === 'join')
      return (
        <BuyInModal
          open={open}
          groupId="g1"
          sessionId="s1"
          mode={mode}
          participants={participants}
          unit={2000}
          onClose={close}
          onSaved={onSaved}
          onCreatePlayer={createPlayer}
        />
      )
    return (
      <PlayerSelectionModal
        open={open}
        participants={participants}
        onClose={close}
        onCreatePlayer={createPlayer}
        action={
          mode === 'group'
            ? { kind: 'players', submit: (ids) => callbacks.onAddPlayers(ids) }
            : { kind: 'draft', unit: 2000, submit: callbacks.onAddDraft }
        }
      />
    )
  }
  const view = render(<App participants={candidates} createPlayer={create} />)
  return {
    ...callbacks,
    rerender: (participants: SelectablePlayer[]) =>
      view.rerender(<App participants={participants} createPlayer={create} />),
    reopen: () => act(() => setOpen(true)),
  }
}
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

describe('player picker through real React and Radix', () => {
  it('adds group members without chip inputs or buy-in writes', async () => {
    const app = mount('group')
    expect(screen.getByRole('searchbox')).toBeTruthy()
    expect(screen.queryByRole('spinbutton')).toBeNull()
    choose('Alice')
    choose('Bob')
    await submit()
    expect(app.onAddPlayers).toHaveBeenCalledExactlyOnceWith(['Alice', 'Bob'])
    expect(save).not.toHaveBeenCalled()
    expect(join).not.toHaveBeenCalled()
    expect(app.onClose).toHaveBeenCalledOnce()
  })
  it('keeps group errors and selection for retry', async () => {
    const app = mount('group')
    app.onAddPlayers.mockRejectedValueOnce(new Error('Could not add player'))
    choose('Alice')
    await submit()
    expect(screen.getByRole('alert').textContent).toContain(
      'Could not add player',
    )
    expect(selected()).toHaveLength(1)
    expect(app.onClose).not.toHaveBeenCalled()
    await submit()
    expect(app.onClose).toHaveBeenCalledOnce()
  })
  it('stages draft players and custom amounts without saving', async () => {
    const app = mount('draft')
    choose('Alice')
    choose('Bob')
    changeAmount('3500')
    await submit()
    expect(app.onAddDraft).toHaveBeenCalledExactlyOnceWith(
      ['Alice', 'Bob'],
      3500,
    )
    expect(save).not.toHaveBeenCalled()
    expect(join).not.toHaveBeenCalled()
    expect(app.onSaved).not.toHaveBeenCalled()
    expect(app.onClose).toHaveBeenCalledOnce()
  })
  it.each(['join', 'draft', 'group'] as const)(
    'shows search for %s even with few candidates',
    (mode) => {
      mount(mode)
      expect(screen.getByRole('searchbox')).toBeTruthy()
    },
  )
  it('searches all candidates while preserving choices and expanded pages', () => {
    mount(
      'join',
      Array.from({ length: 25 }, (_, i) => ({
        player_id: String(i),
        name: `Player ${i}`,
        settled_at: null,
      })),
    )
    choose('Player 0')
    fireEvent.click(button('Show 10 more players'))
    search(' PLAYER 24 ')
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(
      screen.queryByRole('button', { name: 'Show 10 more players' }),
    ).toBeNull()
    choose('Player 24')
    search('')
    expect(screen.getAllByRole('checkbox')).toHaveLength(20)
    expect(selected()).toHaveLength(1)
    fireEvent.click(button('Show 10 more players'))
    expect(selected()).toHaveLength(2)
  })
  it('prefills creation from search without writing automatically', () => {
    const create = vi.fn()
    mount('join', players, create)
    search(' Dave ')
    expect(screen.getByText('No matching players.')).toBeTruthy()
    fireEvent.click(button('+ NEW PLAYER'))
    expect(
      (
        screen.getByRole('textbox', {
          name: 'New player name',
        }) as HTMLInputElement
      ).value,
    ).toBe('Dave')
    expect(create).not.toHaveBeenCalled()
  })
  it('expands ten at a time and resets pagination and choices after close', async () => {
    const app = mount(
      'join',
      Array.from({ length: 25 }, (_, i) => ({
        player_id: String(i),
        name: `Player ${i}`,
        settled_at: null,
      })),
    )
    expect(screen.getAllByRole('checkbox')).toHaveLength(10)
    choose('Player 0')
    fireEvent.click(button('Show 10 more players'))
    choose('Player 15')
    fireEvent.click(button('Show 10 more players'))
    expect(screen.getAllByRole('checkbox')).toHaveLength(25)
    expect(selected()).toHaveLength(2)
    fireEvent.click(button('Close'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    app.reopen()
    expect(screen.getAllByRole('checkbox')).toHaveLength(10)
    expect(selected()).toHaveLength(0)
  })
  it('shows every active session player without search or pagination', () => {
    mount(
      'buy-in',
      Array.from({ length: 15 }, (_, i) => ({
        player_id: String(i),
        name: `P${i}`,
        settled_at: null,
      })),
    )
    expect(screen.getAllByRole('checkbox')).toHaveLength(15)
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Show 10 more players' }),
    ).toBeNull()
  })
  it('creates inline and preserves selection and amount', async () => {
    const dave = { player_id: 'dave', name: 'Dave', settled_at: null }
    const create = vi.fn(async () => {
      app.rerender([...players, dave])
      return dave
    })
    const app = mount('join', players, create)
    choose('Alice')
    changeAmount('3500')
    fireEvent.click(button('+ NEW PLAYER'))
    createName(' Dave ')
    expect(submitButton().disabled).toBe(true)
    fireEvent.click(button('CREATE'))
    await waitFor(() => expect(selected()).toHaveLength(2))
    expect(create).toHaveBeenCalledExactlyOnceWith('Dave')
    expect(join).not.toHaveBeenCalled()
    await submit()
    expect(join.mock.calls[0][2]).toMatchObject({
      amount: 3500,
      entries: [{ player_id: 'Alice' }, { player_id: 'dave' }],
    })
  })
  it('cancels creation without losing selection', () => {
    const create = vi.fn()
    mount('join', players, create)
    choose('Alice')
    fireEvent.click(button('+ NEW PLAYER'))
    createName('Draft')
    fireEvent.click(button('CANCEL'))
    expect(create).not.toHaveBeenCalled()
    expect(selected()).toHaveLength(1)
    expect(
      screen.queryByRole('textbox', { name: 'New player name' }),
    ).toBeNull()
  })
  it('shows inline creation failures without joining', async () => {
    const app = mount(
      'join',
      players,
      vi.fn().mockRejectedValue(new Error('Could not create player')),
    )
    fireEvent.click(button('+ NEW PLAYER'))
    createName('Dave')
    fireEvent.click(button('CREATE'))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'Could not create player',
      ),
    )
    expect(join).not.toHaveBeenCalled()
    expect(app.onClose).not.toHaveBeenCalled()
  })
  it.each([
    ['default', '2000'],
    ['custom', '3500'],
    ['preset', '6000'],
  ])('joins using the %s initial buy-in', async (kind, amount) => {
    const app = mount('join')
    choose('Alice')
    choose('Bob')
    if (kind === 'custom') changeAmount(amount)
    if (kind === 'preset') fireEvent.click(button('6,000'))
    await submit()
    expect(join).toHaveBeenCalledExactlyOnceWith('g1', 's1', {
      amount: Number(amount),
      entries: [
        { id: expect.any(String), player_id: 'Alice' },
        { id: expect.any(String), player_id: 'Bob' },
      ],
    })
    expect(save).not.toHaveBeenCalled()
    expect(app.onSaved).toHaveBeenCalledOnce()
    expect(app.onClose).toHaveBeenCalledOnce()
  })
  it('hides cashed-out players and selects multiple active players', () => {
    mount()
    expect(screen.queryByText('Carol')).toBeNull()
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    choose('Alice')
    choose('Bob')
    expect(selected()).toHaveLength(2)
  })
  it('requires a player and positive integer amount', () => {
    mount()
    expect(submitButton().disabled).toBe(true)
    choose('Alice')
    expect(submitButton().disabled).toBe(false)
    for (const value of ['', '0', '-1', '1.5', '2147483648']) {
      changeAmount(value)
      expect(submitButton().disabled).toBe(true)
    }
  })
  it('blocks duplicate submission and dismissal while saving', async () => {
    let finish!: () => void
    save.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ count: 2 })
        }),
    )
    const app = mount()
    choose('Alice')
    choose('Bob')
    changeAmount('4000')
    fireEvent.submit(submitButton().form!)
    fireEvent.submit(submitButton().form!)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(save).toHaveBeenCalledTimes(1)
    expect(app.onClose).not.toHaveBeenCalled()
    expect(save.mock.calls[0][2]).toMatchObject({
      amount: 4000,
      entries: [{ player_id: 'Alice' }, { player_id: 'Bob' }],
    })
    await act(async () => finish())
    expect(app.onClose).toHaveBeenCalledOnce()
    expect(app.onSaved).toHaveBeenCalledOnce()
  })
  it('preserves retry IDs when dismissal is requested after a lost response', async () => {
    save
      .mockRejectedValueOnce(new TypeError('Network error'))
      .mockResolvedValueOnce({ count: 1 })
    const app = mount()
    choose('Alice')
    await submit()
    const first = save.mock.calls[0][2]
    expect(button('RETRY')).toBeTruthy()
    fireEvent.click(button('Close'))
    expect(app.onClose).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    app.reopen()
    await submit()
    expect(save.mock.calls[1][2]).toEqual(first)
    expect(app.onSaved).toHaveBeenCalledExactlyOnceWith(first)
  })
  it.each(['buy-in', 'join', 'draft'] as const)(
    'resets %s after success for a fresh next command',
    async (mode) => {
      const app = mount(mode)
      const record = mode === 'join' ? join : save
      if (mode !== 'draft')
        record
          .mockRejectedValueOnce(new TypeError('Lost response'))
          .mockResolvedValue({ count: 1 })
      choose('Alice')
      changeAmount('3500')
      await submit()
      if (mode !== 'draft') {
        expect(app.onClose).not.toHaveBeenCalled()
        await submit()
        expect(record.mock.calls[1][2]).toEqual(record.mock.calls[0][2])
      }
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      app.reopen()
      expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe(
        '2000',
      )
      expect(selected()).toHaveLength(0)
      choose('Bob')
      await submit()
      expect(app.onClose).toHaveBeenCalledTimes(2)
      if (mode === 'draft')
        expect(app.onAddDraft).toHaveBeenLastCalledWith(['Bob'], 2000)
      else {
        expect(record.mock.calls[2][2]).toMatchObject({
          amount: 2000,
          entries: [{ player_id: 'Bob' }],
        })
        expect(record.mock.calls[2][2].entries[0].id).not.toBe(
          record.mock.calls[0][2].entries[0].id,
        )
      }
    },
  )
  it('unlocks selection after a definitive command rejection', async () => {
    save.mockRejectedValueOnce(
      new ApiClientError(422, { error: 'Participant no longer in session' }),
    )
    mount()
    choose('Alice')
    await submit()
    expect(screen.getByRole('alert').textContent).toContain(
      'Participant no longer in session',
    )
    choose('Bob')
    expect(selected()).toHaveLength(2)
  })
  it('retries the original command after refreshed candidates disappear', async () => {
    join
      .mockRejectedValueOnce(new TypeError('Lost response'))
      .mockResolvedValueOnce({ count: 1 })
    const app = mount('join')
    choose('Alice')
    await submit()
    const first = join.mock.calls[0][2]
    app.rerender([])
    await submit()
    expect(join.mock.calls[1][2]).toEqual(first)
    expect(app.onClose).toHaveBeenCalledOnce()
  })
  it.each([401, 403, 408, 429])(
    'retains IDs through HTTP %s retry failures',
    async (status) => {
      save
        .mockRejectedValueOnce(new TypeError('Lost response'))
        .mockRejectedValueOnce(
          new ApiClientError(status, { error: 'Retry later' }),
        )
        .mockResolvedValueOnce({ count: 1 })
      mount()
      choose('Alice')
      await submit()
      await submit()
      await submit()
      expect(save.mock.calls[1][2]).toEqual(save.mock.calls[0][2])
      expect(save.mock.calls[2][2]).toEqual(save.mock.calls[0][2])
    },
  )
  it('locks group submission and Escape while adding members', async () => {
    let finish!: () => void
    const app = mount('group')
    app.onAddPlayers.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    choose('Alice')
    fireEvent.submit(submitButton().form!)
    fireEvent.submit(submitButton().form!)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(app.onAddPlayers).toHaveBeenCalledOnce()
    expect(app.onClose).not.toHaveBeenCalled()
    await act(async () => finish())
    expect(app.onClose).toHaveBeenCalledOnce()
  })
})
