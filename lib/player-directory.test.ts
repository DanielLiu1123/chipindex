// @vitest-environment jsdom
import { renderHook, act, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { usePlayerDirectory } from './use-player-directory'
import { createPlayerInGroup } from './client'
import type { Player } from './domain-types'
vi.mock('./client', () => ({ createPlayerInGroup: vi.fn() }))
const create = vi.mocked(createPlayerInGroup)
const alice: Player = {
  id: 'a',
  name: 'Alice',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  deleted_at: null,
}
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it('reuses names, rejects excluded players and empty names', async () => {
  const options = {
    groupId: 'g1',
    players: [alice],
    excludedIds: [] as string[],
    excludedMessage: 'Already selected',
  }
  const hook = renderHook((props) => usePlayerDirectory(props), {
    initialProps: options,
  })
  await act(async () => {
    expect(await hook.result.current.create(' ALICE ')).toMatchObject({
      player_id: 'a',
    })
  })
  hook.rerender({ ...options, excludedIds: ['a'] })
  await expect(hook.result.current.create('alice')).rejects.toThrow(
    'Already selected',
  )
  await expect(hook.result.current.create('  ')).rejects.toThrow(
    'Enter a player name',
  )
  expect(create).not.toHaveBeenCalled()
})
it('retains new group players across refresh until the selection closes', async () => {
  const bob = { ...alice, id: 'b', name: 'Bob' }
  const row = {
    player: bob,
    group_player: {
      id: 'gp',
      group_id: 'g1',
      player_id: 'b',
      created_at: '',
      updated_at: '',
      deleted_at: null,
    },
  }
  create.mockResolvedValue(row)
  const options = {
    groupId: 'g1',
    players: [alice],
    excludedIds: [] as string[],
    excludedMessage: 'Already in group',
    retainCreatedSelections: true,
    onCreated: vi.fn(),
  }
  const hook = renderHook((props) => usePlayerDirectory(props), {
    initialProps: options,
  })
  await act(async () => {
    await hook.result.current.create(' Bob ')
  })
  expect(create).toHaveBeenCalledExactlyOnceWith('g1', 'Bob')
  expect(options.onCreated).toHaveBeenCalledWith(row)
  hook.rerender({ ...options, players: [alice, bob], excludedIds: ['b'] })
  expect(hook.result.current.participants.map((p) => p.player_id)).toEqual([
    'b',
    'a',
  ])
  await act(async () => {
    await hook.result.current.create('bob')
  })
  act(() => hook.result.current.resetSelection())
  expect(hook.result.current.participants.map((p) => p.player_id)).toEqual([
    'a',
  ])
  hook.rerender({ ...options, players: [alice, bob] })
  await act(async () => {
    expect(await hook.result.current.create('Bob')).toMatchObject({
      player_id: 'b',
    })
  })
  expect(create).toHaveBeenCalledTimes(1)
})
it('excludes staged session players while preserving their names before refresh', async () => {
  create.mockResolvedValue({ player: alice } as Awaited<
    ReturnType<typeof createPlayerInGroup>
  >)
  const options = {
    groupId: 'g1',
    players: [] as Player[],
    excludedIds: [] as string[],
    excludedMessage: 'Already selected',
  }
  const hook = renderHook((props) => usePlayerDirectory(props), {
    initialProps: options,
  })
  await act(async () => {
    await hook.result.current.create('Alice')
  })
  hook.rerender({ ...options, excludedIds: ['a'] })
  expect(hook.result.current.participants).toEqual([])
  expect(hook.result.current.players).toEqual([alice])
  await expect(hook.result.current.create('Alice')).rejects.toThrow(
    'Already selected',
  )
})
