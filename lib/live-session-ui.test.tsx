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
import LiveSession from '../components/LiveSession'
import {
  ApiClientError,
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
        name: 'SETTLE SESSION',
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
  click('SETTLE SESSION')
  fireEvent.change(screen.getByLabelText('final chips for Alice'), {
    target: { value: '2100' },
  })
  click('CONFIRM SETTLE')
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
  click('SETTLE SESSION')
  fireEvent.change(screen.getByLabelText('final chips for Alice'), {
    target: { value: '2000' },
  })
  click('CONFIRM SETTLE')
  await screen.findByText('Unavailable')
  click('CANCEL')
  expect(screen.queryByText('Unavailable')).toBeNull()
  click('SETTLE SESSION')
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
  click('✕')
  await screen.findByText('Cannot revoke')
  expect(nav.refresh).not.toHaveBeenCalled()
  click('✕')
  await waitFor(() => expect(nav.refresh).toHaveBeenCalledOnce())
  expect(screen.queryByText('Cannot revoke')).toBeNull()
})
