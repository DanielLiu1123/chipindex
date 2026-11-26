// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import LiveSession from '../components/LiveSession'
import {
  ApiClientError,
  updateSession,
  cashOutSessionParticipant,
  removeSessionParticipant,
  revokeBuyIn,
  settleSession,
} from './client'
import type { LiveSessionData } from './domain-types'
const nav = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => nav }))
vi.mock('./client', async (original) => ({
  ...(await original<typeof import('./client')>()),
  cashOutSessionParticipant: vi.fn(),
  removeSessionParticipant: vi.fn(),
  revokeBuyIn: vi.fn(),
  settleSession: vi.fn(),
  updateSession: vi.fn(),
}))
const session: LiveSessionData = {
  id: 's1',
  date: '2026-09-22',
  description: null,
  exchange_rate: 40,
  buy_in_unit: 2000,
  started_at: '2026-09-22T08:00:00Z',
  status: 'OPEN',
  participants: [
    {
      player_id: 'alice',
      name: 'Alice',
      final_chips: null,
      settled_at: null,
      total_buyin: 2000,
      buy_ins: [
        {
          id: 'b1',
          player_id: 'alice',
          amount: 2000,
          created_at: '2026-09-22T08:00:00Z',
        },
      ],
    },
  ],
}
const mount = () =>
  render(<LiveSession groupId="g1" session={session} allPlayers={[]} />)
const click = (name: string) =>
  fireEvent.click(screen.getByRole('button', { name }))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
it('preserves failed cash-out input, blocks duplicate commands and refreshes after success', async () => {
  vi.mocked(cashOutSessionParticipant).mockRejectedValueOnce(
    new Error('Unavailable'),
  )
  mount()
  click('CASH OUT')
  const dialog = screen.getByRole('dialog', { name: 'Cash out Alice' })
  fireEvent.change(within(dialog).getByRole('spinbutton'), {
    target: { value: '2500' },
  })
  fireEvent.submit(dialog.querySelector('form')!)
  await screen.findByText('Unavailable')
  expect(nav.refresh).not.toHaveBeenCalled()
  expect(
    (within(dialog).getByRole('spinbutton') as HTMLInputElement).value,
  ).toBe('2500')
  let finish!: () => void
  vi.mocked(cashOutSessionParticipant).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => resolve(undefined)
      }),
  )
  fireEvent.submit(dialog.querySelector('form')!)
  fireEvent.submit(dialog.querySelector('form')!)
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(cashOutSessionParticipant).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('dialog')).toBeTruthy()
  await act(async () => finish())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(nav.refresh).toHaveBeenCalledOnce()
  expect(cashOutSessionParticipant).toHaveBeenLastCalledWith('g1', 's1', {
    player_id: 'alice',
    final_chips: 2500,
  })
})
it('keeps failed removal in its confirmation and restores actions after retry', async () => {
  vi.mocked(removeSessionParticipant)
    .mockRejectedValueOnce(new Error('Could not remove'))
    .mockResolvedValueOnce(undefined)
  mount()
  click('remove player')
  click('REMOVE')
  await screen.findByText('Could not remove')
  expect(screen.getByRole('alertdialog')).toBeTruthy()
  expect(nav.refresh).not.toHaveBeenCalled()
  click('REMOVE')
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
  expect(nav.refresh).toHaveBeenCalledOnce()
  expect(removeSessionParticipant).toHaveBeenCalledTimes(2)
  expect(
    (
      screen.getByRole('button', {
        name: 'SETTLE',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false)
})
it('keeps settlement values after an unbalanced response and explicitly force-settles', async () => {
  vi.mocked(settleSession)
    .mockRejectedValueOnce(
      new ApiClientError(422, { code: 'unbalanced', diff: 100 }),
    )
    .mockResolvedValueOnce({ id: 's1', diff: 100 })
  mount()
  click('SETTLE')
  fireEvent.change(screen.getByLabelText('final chips for Alice'), {
    target: { value: '2100' },
  })
  click('CONFIRM')
  await screen.findByRole('button', { name: 'FORCE SETTLE →' })
  expect(
    (screen.getByLabelText('final chips for Alice') as HTMLInputElement).value,
  ).toBe('2100')
  expect(nav.push).not.toHaveBeenCalled()
  click('FORCE SETTLE →')
  await waitFor(() =>
    expect(nav.push).toHaveBeenCalledWith('/groups/g1/sessions/s1'),
  )
  expect(vi.mocked(settleSession).mock.calls).toEqual([
    [
      'g1',
      's1',
      { finals: [{ player_id: 'alice', final_chips: 2100 }], force: false },
    ],
    [
      'g1',
      's1',
      { finals: [{ player_id: 'alice', final_chips: 2100 }], force: true },
    ],
  ])
  expect(nav.refresh).toHaveBeenCalledOnce()
})
it('retains cancelled settlement drafts and clears stale errors when opening another operation', async () => {
  vi.mocked(settleSession).mockRejectedValueOnce(new Error('Unavailable'))
  mount()
  click('SETTLE')
  fireEvent.change(screen.getByLabelText('final chips for Alice'), {
    target: { value: '2000' },
  })
  click('CONFIRM')
  await screen.findByText('Unavailable')
  click('CANCEL')
  expect(screen.queryByText('Unavailable')).toBeNull()
  click('SETTLE')
  expect(
    (screen.getByLabelText('final chips for Alice') as HTMLInputElement).value,
  ).toBe('2000')
  click('CANCEL')
  click('+ BUY IN')
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
})
it('refreshes after revocation and keeps recoverable errors in the page', async () => {
  vi.mocked(revokeBuyIn)
    .mockRejectedValueOnce(new Error('Cannot revoke'))
    .mockResolvedValueOnce(undefined)
  mount()
  click('Alice buy-in history')
  click('Revoke Alice buy-in')
  await screen.findByText('Cannot revoke')
  expect(nav.refresh).not.toHaveBeenCalled()
  click('Revoke Alice buy-in')
  await waitFor(() => expect(nav.refresh).toHaveBeenCalledOnce())
  expect(screen.queryByText('Cannot revoke')).toBeNull()
})

it('edits the rate, preserves failed drafts, and refreshes after a single successful save', async () => {
  vi.mocked(updateSession).mockRejectedValueOnce(new Error('Cannot save rate'))
  const view = mount()
  expect(screen.getByText('40 chips = 1 CNY')).toBeTruthy()
  click('40 chips = 1 CNY')
  const dialog = screen.getByRole('dialog', { name: 'Edit rate' })
  expect(within(dialog).queryByRole('button', { name: 'Close' })).toBeNull()
  const input = within(dialog).getByRole('spinbutton') as HTMLInputElement
  expect(input.value).toBe('40')
  for (const value of ['', '0', '-1']) {
    fireEvent.change(input, { target: { value } })
    fireEvent.submit(dialog.querySelector('form')!)
    expect(updateSession).not.toHaveBeenCalled()
  }
  fireEvent.change(input, { target: { value: '20.5' } })
  click('SAVE')
  await screen.findByText('Cannot save rate')
  expect(input.value).toBe('20.5')
  expect(nav.refresh).not.toHaveBeenCalled()
  let finish!: () => void
  vi.mocked(updateSession).mockImplementationOnce(() => new Promise(resolve => {
    finish = () => resolve({ id: 's1' })
  }))
  fireEvent.submit(dialog.querySelector('form')!)
  fireEvent.submit(dialog.querySelector('form')!)
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(updateSession).toHaveBeenCalledTimes(2)
  await act(async () => finish())
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(nav.refresh).toHaveBeenCalledOnce()
  expect(updateSession).toHaveBeenLastCalledWith('g1', 's1', { exchange_rate: 20.5 })
  view.rerender(<LiveSession groupId="g1" session={{ ...session, exchange_rate: 20.5 }} allPlayers={[]} />)
  expect(screen.getByText('20.5 chips = 1 CNY')).toBeTruthy()
  click('20.5 chips = 1 CNY')
  expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('20.5')
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '99' } })
  click('CANCEL')
  click('20.5 chips = 1 CNY')
  expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('20.5')
  expect(updateSession).toHaveBeenCalledTimes(2)
})

it('hides the cashed-out summary while retaining participant results and expanded details', () => {
  render(<LiveSession groupId="g1" session={{
    ...session,
    participants: [{
      ...session.participants[0],
      final_chips: 2500,
      settled_at: '2026-09-22T09:00:00Z',
    }],
  }} allPlayers={[]} />)

  expect(screen.queryByText('CASHED OUT')).toBeNull()
  expect(screen.queryByText('NET')).toBeNull()
  expect(screen.getByText('+500')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'undo Alice cash out' })).toBeTruthy()
  click('Alice buy-in history')
  expect(screen.getByText(/CASHED OUT/)).toBeTruthy()
  expect(screen.getByText(/FINAL/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Revoke Alice buy-in' })).toBeNull()
})

it('opens the event log from the live session and dismisses it', () => {
  const { rerender } = render(<LiveSession groupId="g1" session={session} allPlayers={[]} />)
  expect(screen.queryByRole('button', { name: 'EVENT LOG' })).toBeNull()
  rerender(<LiveSession groupId="g1" session={session} allPlayers={[]} events={[
    { id: 'start', time: session.started_at!, text: 'Session started.' },
  ]} />)
  fireEvent.click(screen.getByRole('button', { name: 'EVENT LOG' }))
  const dialog = screen.getByRole('dialog', { name: 'Event log' })
  expect(within(dialog).getByText('Session started.')).toBeTruthy()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('updates the log after each checkbox and clears the player filter', async () => {
  const user = userEvent.setup()
  const time = session.started_at!
  render(<LiveSession groupId="g1" session={session} allPlayers={[]} events={[
    { id: 'settled', time, text: 'Session settled.' },
    { id: 'a', time, player: { id: 'a', name: 'Alice' }, text: 'Alice joined.' },
    { id: 'b', time, player: { id: 'b', name: 'Bob' }, text: 'Bob joined.' },
  ]} />)
  await user.click(screen.getByRole('button', { name: 'EVENT LOG' }))
  await user.click(screen.getByRole('button', { name: 'ALL PLAYERS' }))
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Alice' }))
  expect(screen.queryByText('Bob joined.')).toBeNull()
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Bob' }))
  expect(screen.getByText('Bob joined.')).toBeTruthy()
  expect(screen.getByText('Alice joined.')).toBeTruthy()
  expect(screen.queryByText('Session settled.')).toBeNull()
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: 'Clear' }))
  expect(screen.getByText('Session settled.')).toBeTruthy()
})

it('drops removed players from an open filter when session events refresh', async () => {
  const user = userEvent.setup()
  const time = session.started_at!
  const start = { id: 'start', time, opening: [] }
  const joins = ['Alice', 'Bob'].map(name => ({
    id: name, time, player: { id: name, name }, text: `${name} joined.`,
  }))
  const props = { groupId: 'g1', session, allPlayers: [] }
  const { rerender } = render(<LiveSession {...props} events={[...joins, start]} />)
  await user.click(screen.getByRole('button', { name: 'EVENT LOG' }))
  await user.click(screen.getByRole('button', { name: 'ALL PLAYERS' }))
  for (const { player } of joins) {
    await user.click(screen.getByRole('menuitemcheckbox', { name: player.name }))
  }
  await user.keyboard('{Escape}')

  rerender(<LiveSession {...props} events={[joins[1], start]} />)
  expect(screen.getByRole('button', { name: 'PLAYERS · 1' })).toBeTruthy()
  expect(screen.getByText('Bob joined.')).toBeTruthy()
  expect(screen.queryByText('Session started.')).toBeNull()

  rerender(<LiveSession {...props} events={[start]} />)
  expect(screen.getByText('Session started.')).toBeTruthy()
})
