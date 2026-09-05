import { beforeEach, expect, it, vi } from 'vitest'
import { createHookHarness, loadUiModule } from './test-ui'
import type { usePlayerDirectory } from './use-player-directory'
import type { Player } from './domain-types'

const hooks = createHookHarness()
const create = vi.fn()
const useDirectory = loadUiModule<{ usePlayerDirectory: typeof usePlayerDirectory }>(new URL('./use-player-directory.ts', import.meta.url), {
  react: hooks.react, '@/lib/client': { createPlayerInGroup: create },
}).usePlayerDirectory
const alice: Player = { id: 'a', name: 'Alice', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', deleted_at: null }
beforeEach(() => { hooks.reset(); create.mockReset() })

it('reuses names case-insensitively, rejects excluded players and never creates empty names', async () => {
  const options = { groupId: 'g1', players: [alice], excludedIds: [] as string[], excludedMessage: 'Already selected' }
  const render = () => hooks.render(() => useDirectory(options))
  expect(await render().create(' ALICE ')).toMatchObject({ player_id: 'a' })
  options.excludedIds = ['a']
  await expect(render().create('alice')).rejects.toThrow('Already selected')
  await expect(render().create('  ')).rejects.toThrow('Enter a player name')
  expect(create).not.toHaveBeenCalled()
})

it('retains new group players at the front through refresh, then excludes them on close', async () => {
  const options = { groupId: 'g1', players: [alice], excludedIds: [] as string[], excludedMessage: 'Already in group', retainCreatedSelections: true, onCreated: vi.fn() }
  const bob = { ...alice, id: 'b', name: 'Bob' }
  const row = { player: bob, group_player: { id: 'gp' } }
  create.mockResolvedValue(row)
  const render = () => hooks.render(() => useDirectory(options))
  await render().create(' Bob ')
  expect(create).toHaveBeenCalledExactlyOnceWith('g1', 'Bob')
  expect(options.onCreated).toHaveBeenCalledExactlyOnceWith(row)
  options.players = [alice, bob]; options.excludedIds = ['b']
  expect(render().participants.map(player => player.player_id)).toEqual(['b', 'a'])
  await render().create('bob')
  expect(create).toHaveBeenCalledTimes(1)
  render().resetSelection()
  expect(render().participants.map(player => player.player_id)).toEqual(['a'])
  // Removing membership makes the same player available again without creation.
  options.excludedIds = []
  expect(await render().create('Bob')).toMatchObject({ player_id: 'b' })
  expect(create).toHaveBeenCalledTimes(1)
})

it('immediately excludes newly staged session players but preserves their names before refresh', async () => {
  const options = { groupId: 'g1', players: [] as Player[], excludedIds: [] as string[], excludedMessage: 'Already selected' }
  create.mockResolvedValue({ player: alice })
  const render = () => hooks.render(() => useDirectory(options))
  await render().create('Alice')
  options.excludedIds = ['a']
  expect(render().participants).toEqual([])
  expect(render().players).toEqual([alice])
  await expect(render().create('Alice')).rejects.toThrow('Already selected')
})
