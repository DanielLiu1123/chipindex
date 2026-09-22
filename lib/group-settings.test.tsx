// @vitest-environment jsdom
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import GroupSettings from '../components/GroupSettings'
import { addGroupPlayer, createPlayerInGroup } from './client'
import type { Player, GroupPlayer } from './domain-types'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('./client', async (original) => ({
  ...(await original<typeof import('./client')>()),
  addGroupPlayer: vi.fn(),
  createPlayerInGroup: vi.fn(),
  deleteGroupPlayer: vi.fn(),
  renameGroup: vi.fn(),
}))
const add = vi.mocked(addGroupPlayer),
  create = vi.mocked(createPlayerInGroup)
const timestamps = {
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  deleted_at: null,
}
const player = (id: string): Player => ({ id, name: id, ...timestamps })
const membership = (id: string): GroupPlayer => ({
  id: `gp-${id}`,
  player_id: id,
  group_id: 'g1',
  ...timestamps,
})
function mount() {
  render(
    <GroupSettings
      group={{ id: 'g1', name: 'Group', ...timestamps }}
      initialGroupPlayers={[
        { player: player('Alice'), group_player: membership('Alice') },
      ]}
      players={['Alice', 'Bob', 'Carol'].map(player)}
    />,
  )
  fireEvent.click(screen.getByRole('button', { name: '+ PLAYER' }))
}
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
it('excludes existing members and does not join newly created group players twice', async () => {
  mount()
  expect(screen.queryByRole('checkbox', { name: 'Alice' })).toBeNull()
  create.mockResolvedValue({
    player: player('Dave'),
    group_player: membership('Dave'),
  })
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
  fireEvent.click(screen.getByRole('checkbox', { name: 'Bob' }))
  add.mockResolvedValue(membership('Bob'))
  fireEvent.click(screen.getByRole('button', { name: 'ADD' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(add).toHaveBeenCalledExactlyOnceWith('g1', 'Bob')
  fireEvent.click(screen.getByRole('button', { name: '+ PLAYER' }))
  expect(
    screen.getAllByRole('checkbox').map((el) => el.parentElement?.textContent),
  ).toEqual(['Carol'])
})
it('retains successful joins when a later join fails and retries only remaining players', async () => {
  mount()
  add
    .mockResolvedValueOnce(membership('Bob'))
    .mockRejectedValueOnce(new Error('Unavailable'))
    .mockResolvedValueOnce(membership('Carol'))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Bob' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'Carol' }))
  fireEvent.click(screen.getByRole('button', { name: 'ADD' }))
  await screen.findByText('Unavailable')
  expect(screen.queryByRole('checkbox', { name: 'Bob' })).toBeNull()
  expect(
    within(screen.getByRole('dialog'))
      .getByRole('checkbox', { name: 'Carol' })
      .getAttribute('aria-checked'),
  ).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'ADD' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(add.mock.calls).toEqual([
    ['g1', 'Bob'],
    ['g1', 'Carol'],
    ['g1', 'Carol'],
  ])
})
