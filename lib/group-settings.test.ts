import { Children, isValidElement, type ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { createHookHarness, loadUiModule } from './test-ui'
import type { Player } from './domain-types'

const hooks = createHookHarness()
const add = vi.fn()
const create = vi.fn()
const refresh = vi.fn()
const Modal = () => null
type Props = {
  children?: ReactNode
  participants: { player_id: string }[]
  action: { submit: (ids: string[]) => Promise<void> }
  onCreatePlayer: (name: string) => Promise<{ player_id: string }>
  onClose: () => void
}
function nodes(node: ReactNode): { type: unknown; props: Props }[] {
  const result: { type: unknown; props: Props }[] = []
  Children.forEach(node, child => {
    if (isValidElement<Props>(child)) result.push(child, ...nodes(child.props.children))
  })
  return result
}
const date = '2026-01-01T00:00:00Z'
const player = (id: string): Player => ({ id, name: id, created_at: date, updated_at: date, deleted_at: null })
const membership = (id: string) => ({ id: `gp-${id}`, player_id: id, group_id: 'g1', created_at: date, updated_at: date, deleted_at: null })
function mount() {
  const Component = loadUiModule<{ default: (props: unknown) => ReactNode }>(new URL('../components/GroupSettings.tsx', import.meta.url), {
    react: hooks.react, 'next/link': () => null, 'next/navigation': { useRouter: () => ({ refresh }) },
    '@/components/ConfirmModal': () => null, '@/components/PlayerSelectionModal': Modal,
    '@/lib/client': { addGroupPlayer: add, createPlayerInGroup: create },
  }).default
  const render = () => hooks.render(() => Component({ group: { id: 'g1', name: 'Group' },
    initialGroupPlayers: [{ player: player('Alice'), group_player: membership('Alice') }],
    players: ['Alice', 'Bob', 'Carol'].map(player) }))
  return { modal: () => nodes(render()).find(node => node.type === Modal)!.props }
}
beforeEach(() => { hooks.reset(); add.mockReset(); create.mockReset(); refresh.mockReset() })

it('excludes members, retains created players for selection, and does not join them twice', async () => {
  const app = mount()
  expect(app.modal().participants.map(player => player.player_id)).toEqual(['Bob', 'Carol'])
  create.mockResolvedValue({ player: player('Dave'), group_player: membership('Dave') })
  await app.modal().onCreatePlayer('Dave')
  expect(app.modal().participants[0].player_id).toBe('Dave')
  add.mockResolvedValue(membership('Bob'))
  await app.modal().action.submit(['Dave', 'Bob'])
  expect(add).toHaveBeenCalledExactlyOnceWith('g1', 'Bob')
  app.modal().onClose()
  expect(app.modal().participants.map(player => player.player_id)).toEqual(['Carol'])
})

it('retains successful members when another add fails and retries only remaining candidates', async () => {
  const app = mount()
  add.mockResolvedValueOnce(membership('Bob')).mockRejectedValueOnce(new Error('Unavailable'))
    .mockResolvedValueOnce(membership('Carol'))
  await expect(app.modal().action.submit(['Bob', 'Carol'])).rejects.toThrow('Unavailable')
  expect(app.modal().participants.map(player => player.player_id)).toEqual(['Carol'])
  await app.modal().action.submit(['Bob', 'Carol'])
  expect(add.mock.calls).toEqual([['g1', 'Bob'], ['g1', 'Carol'], ['g1', 'Carol']])
  expect(app.modal().participants).toEqual([])
})
