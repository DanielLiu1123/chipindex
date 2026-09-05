import { Children, isValidElement, type ReactNode } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { createHookHarness, loadUiModule } from './test-ui'
import { ApiClientError } from './client'

const hooks = createHookHarness()
const update = vi.fn()
const create = vi.fn()
const push = vi.fn()
const Modal = () => null
const Confirm = () => null
type Props = {
  children?: ReactNode; 'aria-label'?: string; value?: string
  participants: { player_id: string }[]
  action: { kind: string; unit: number; submit: (ids: string[], amount: number) => void }
  onCreatePlayer: (name: string) => Promise<{ player_id: string }>
  onChange: (event: { target: { value: string } }) => void
  onClick: () => Promise<void> | void
  onConfirm: () => void
}
function nodes(node: ReactNode): { type: unknown; props: Props }[] {
  const result: { type: unknown; props: Props }[] = []
  Children.forEach(node, child => {
    if (isValidElement<Props>(child)) result.push(child, ...nodes(child.props.children))
  })
  return result
}
function mount() {
  const Component = loadUiModule<{ default: (props: unknown) => ReactNode }>(new URL('../components/EditSessionForm.tsx', import.meta.url), {
    react: hooks.react, 'next/link': () => null, 'next/navigation': { useRouter: () => ({ push, refresh: vi.fn() }) },
    '@/components/PlayerSelectionModal': Modal, '@/components/ConfirmModal': Confirm,
    '@/components/SessionMetaFields': () => null, '@/components/ChipValue': () => null,
    '@/lib/client': { updateSession: update, createPlayerInGroup: create, ApiClientError },
    '@/lib/synth': { BUY_IN_UNIT: 2000 },
  }).default
  const render = () => nodes(hooks.render(() => Component({ groupId: 'g1', sessionId: 's1',
    initialPlayers: ['Alice', 'Bob', 'Carol'].map(name => ({ id: name, name })),
    session: { date: '2026-09-05', ended_at: '2026-09-05T20:00:00Z', exchange_rate: 40,
      participants: [{ player_id: 'Alice', name: 'Alice', final_chips: 2000,
        buy_ins: [{ amount: 2000, created_at: '2026-09-05T18:00:00Z' }] }] },
  })))
  return {
    render,
    modal: () => render().find(node => node.type === Modal)!.props,
    final: (name: string, value: string) => render().find(node => node.props['aria-label'] === `final chips for ${name}`)!.props.onChange({ target: { value } }),
    save: () => render().find(node => node.type === 'button' && node.props.children === 'SAVE CHANGES')!.props.onClick(),
  }
}
beforeEach(() => { hooks.reset(); update.mockReset(); create.mockReset(); push.mockReset() })

it('stages multiple players with custom buy-ins and preserves existing history until SAVE', async () => {
  const app = mount()
  expect(app.modal().participants.map(player => player.player_id)).toEqual(['Bob', 'Carol'])
  expect(app.modal().action).toMatchObject({ kind: 'draft', unit: 2000 })
  app.modal().action.submit(['Bob', 'Carol', 'Bob'], 3500)
  expect(update).not.toHaveBeenCalled()
  expect(app.modal().participants).toEqual([])
  // A missing final must not silently drop the newly added player.
  app.final('Bob', '3500'); await app.save()
  expect(update).not.toHaveBeenCalled()
  app.final('Carol', '3500')
  update.mockResolvedValue({ id: 's1' }); await app.save()
  expect(update).toHaveBeenCalledExactlyOnceWith('g1', 's1', expect.objectContaining({ participants: [
    { player_id: 'Alice', final_chips: 2000, buy_ins: [{ amount: 2000, created_at: '2026-09-05T18:00:00.000Z' }] },
    { player_id: 'Bob', final_chips: 3500, buy_ins: [{ amount: 3500, created_at: '2026-09-05T20:00:00.000Z' }] },
    { player_id: 'Carol', final_chips: 3500, buy_ins: [{ amount: 3500, created_at: '2026-09-05T20:00:00.000Z' }] },
  ] }))
})

it('keeps a new player ID through save failure without recreating the player', async () => {
  const app = mount()
  create.mockResolvedValue({ player: { id: 'Dave', name: 'Dave' } })
  await app.modal().onCreatePlayer('Dave')
  app.modal().action.submit(['Dave'], 2000); app.final('Dave', '2000')
  update.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce({ id: 's1' })
  await app.save(); await app.save()
  expect(create).toHaveBeenCalledExactlyOnceWith('g1', 'Dave')
  expect(update.mock.calls[1][2].participants[1].player_id).toBe('Dave')
})

it('makes removed staged players available again without saving', () => {
  const app = mount(); app.modal().action.submit(['Bob'], 2000)
  app.render().find(node => node.props['aria-label'] === 'remove Bob')!.props.onClick()
  app.render().find(node => node.type === Confirm)!.props.onConfirm()
  expect(app.modal().participants.map(player => player.player_id)).toEqual(['Bob', 'Carol'])
  expect(update).not.toHaveBeenCalled()
})
