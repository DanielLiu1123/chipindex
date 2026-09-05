import { Children, isValidElement, type ReactNode } from 'react'
import { createHookHarness, loadUiModule } from './test-ui'
import { beforeEach, expect, it, vi } from 'vitest'

const start = vi.fn()
const create = vi.fn()
const push = vi.fn()
const hooks = createHookHarness()
const Modal = () => null
type NodeProps = {
  children?: ReactNode; type?: string; disabled?: boolean; value?: string; 'aria-label'?: string
  participants: { player_id: string }[]
  action: { submit: (ids: string[], amount: number) => void }
  onCreatePlayer: (name: string) => Promise<{ player_id: string }>
  onChange: (e: { target: { value: string } }) => void
  onClick: () => void
  onSubmit: (e: { preventDefault: () => void }) => Promise<void>
}
function nodes(node: ReactNode): { type: unknown; props: NodeProps }[] {
  const result: { type: unknown; props: NodeProps }[] = []
  Children.forEach(node, child => {
    if (!isValidElement<NodeProps>(child)) return
    result.push(child, ...nodes(child.props.children))
  })
  return result
}
function mount() {
  const mocks: Record<string, unknown> = {
    react: hooks.react, 'next/navigation': { useRouter: () => ({ push }) },
    'next/link': () => null, '@/components/PlayerSelectionModal': Modal, '@/components/SessionMetaFields': () => null,
    '@/lib/client': { startSession: start, createPlayerInGroup: create },
    '@/lib/synth': { BUY_IN_UNIT: 2000 }, '@/lib/uid': { uid: () => crypto.randomUUID() },
  }
  const module = loadUiModule<{ default: (props: unknown) => ReactNode }>(new URL('../components/NewSessionForm.tsx', import.meta.url), mocks)
  const render = () => {
    return nodes(hooks.render(() => module.default({ groupId: 'g1', initialPlayers: [{ id: 'a', name: 'Alice' }, { id: 'b', name: 'Bob' }] })))
  }
  return {
    render,
    modal: () => render().find(n => n.type === Modal)!.props,
    submit: () => render().find(n => n.type === 'form')!.props.onSubmit({ preventDefault() {} }),
  }
}
beforeEach(() => { hooks.reset(); start.mockReset(); create.mockReset(); push.mockReset() })

it('stages unique players, allows editing/removal, and creates the session only on START', async () => {
  const app = mount()
  app.modal().action.submit(['a', 'b'], 3500)
  app.modal().action.submit(['a'], 2000)
  expect(start).not.toHaveBeenCalled()
  expect(app.modal().participants).toEqual([])
  expect(app.render().filter(n => n.type === 'input')).toHaveLength(2)
  app.render().find(n => n.props['aria-label'] === 'buy-in for Alice')!.props.onChange({ target: { value: '6000' } })
  app.render().find(n => n.props['aria-label'] === 'remove Bob')!.props.onClick()
  expect(app.modal().participants).toEqual([expect.objectContaining({ player_id: 'b' })])
  start.mockResolvedValue({ id: 's1' })
  await app.submit()
  expect(start).toHaveBeenCalledExactlyOnceWith('g1', expect.objectContaining({ status: 'OPEN', players: [{ player_id: 'a', initial_buyin: 6000 }] }))
  expect(push).toHaveBeenCalledWith('/groups/g1/sessions/s1')
})

it('retains newly created players and staged amounts after a failed START', async () => {
  const app = mount()
  create.mockResolvedValue({ player: { id: 'new', name: 'Dave' } })
  expect(await app.modal().onCreatePlayer('Dave')).toMatchObject({ player_id: 'new' })
  expect(app.modal().participants[0].player_id).toBe('new')
  app.modal().action.submit(['new'], 2000)
  start.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce({ id: 's1' })
  await app.submit()
  expect(push).not.toHaveBeenCalled()
  expect(app.render().find(n => n.props['aria-label'] === 'buy-in for Dave')!.props.value).toBe('2000')
  await app.submit()
  expect(create).toHaveBeenCalledTimes(1)
  expect(start.mock.calls[1][1].players).toEqual([{ player_id: 'new', initial_buyin: 2000 }])
})

it('rejects invalid staged buy-ins without starting a session', async () => {
  const app = mount(); app.modal().action.submit(['a'], 2000)
  app.render().find(n => n.props['aria-label'] === 'buy-in for Alice')!.props.onChange({ target: { value: '1.5' } })
  expect(app.render().find(n => n.props.type === 'submit')!.props.disabled).toBe(true)
  await app.submit()
  expect(start).not.toHaveBeenCalled()
})
