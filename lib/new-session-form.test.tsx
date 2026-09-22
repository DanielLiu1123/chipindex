// @vitest-environment jsdom
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import NewSessionForm from '../components/NewSessionForm'
import { createPlayerInGroup, startSession } from './client'
import type { Player } from './domain-types'
const nav = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => nav }))
vi.mock('./client', async (original) => ({
  ...(await original<typeof import('./client')>()),
  startSession: vi.fn(),
  createPlayerInGroup: vi.fn(),
}))
const start = vi.mocked(startSession),
  create = vi.mocked(createPlayerInGroup)
const players: Player[] = ['Alice', 'Bob'].map((id) => ({
  id,
  name: id,
  created_at: '',
  updated_at: '',
  deleted_at: null,
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
async function stage(names: string[], amount = '2000') {
  fireEvent.click(screen.getByRole('button', { name: '+ PLAYER' }))
  const dialog = screen.getByRole('dialog')
  names.forEach((name) =>
    fireEvent.click(within(dialog).getByRole('checkbox', { name })),
  )
  fireEvent.change(within(dialog).getByRole('spinbutton'), {
    target: { value: amount },
  })
  fireEvent.click(within(dialog).getByRole('button', { name: 'ADD' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
}
it('stages unique players, edits/removes them, and starts only on START', async () => {
  render(<NewSessionForm groupId="g1" initialPlayers={players} />)
  await stage(['Alice', 'Bob'], '3500')
  expect(start).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '+ PLAYER' }))
  expect(screen.queryByRole('checkbox')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  fireEvent.change(screen.getByLabelText('buy-in for Alice'), {
    target: { value: '6000' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'remove Bob' }))
  start.mockResolvedValue({ id: 's1' })
  fireEvent.click(screen.getByRole('button', { name: 'START' }))
  await waitFor(() =>
    expect(nav.push).toHaveBeenCalledWith('/groups/g1/sessions/s1'),
  )
  expect(start).toHaveBeenCalledExactlyOnceWith(
    'g1',
    expect.objectContaining({
      status: 'OPEN',
      players: [{ player_id: 'Alice', initial_buyin: 6000 }],
    }),
  )
})
it('retains newly created players and staged amounts after a failed START', async () => {
  create.mockResolvedValue({
    player: { ...players[0], id: 'dave', name: 'Dave' },
  } as Awaited<ReturnType<typeof createPlayerInGroup>>)
  render(<NewSessionForm groupId="g1" initialPlayers={players} />)
  fireEvent.click(screen.getByRole('button', { name: '+ PLAYER' }))
  fireEvent.click(screen.getByRole('button', { name: '+ NEW PLAYER' }))
  fireEvent.change(screen.getByLabelText('New player name'), {
    target: { value: 'Dave' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'CREATE' }))
  await waitFor(() =>
    expect(
      screen
        .getByRole('checkbox', { name: 'Dave' })
        .getAttribute('aria-checked'),
    ).toBe('true'),
  )
  fireEvent.click(screen.getByRole('button', { name: 'ADD' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  start
    .mockRejectedValueOnce(new Error('Unavailable'))
    .mockResolvedValueOnce({ id: 's1' })
  fireEvent.click(screen.getByRole('button', { name: 'START' }))
  await screen.findByText('Unavailable')
  expect(nav.push).not.toHaveBeenCalled()
  expect(
    (screen.getByLabelText('buy-in for Dave') as HTMLInputElement).value,
  ).toBe('2000')
  fireEvent.click(screen.getByRole('button', { name: 'START' }))
  await waitFor(() => expect(start).toHaveBeenCalledTimes(2))
  expect(create).toHaveBeenCalledOnce()
  expect(start.mock.calls[1][1].players).toEqual([
    { player_id: 'dave', initial_buyin: 2000 },
  ])
})
it('rejects invalid staged amounts even when the form is submitted directly', async () => {
  render(<NewSessionForm groupId="g1" initialPlayers={players} />)
  await stage(['Alice'])
  fireEvent.change(screen.getByLabelText('buy-in for Alice'), {
    target: { value: '1.5' },
  })
  const button = screen.getByRole('button', {
    name: 'START',
  }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  fireEvent.submit(button.form!)
  expect(start).not.toHaveBeenCalled()
})
