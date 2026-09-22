import { expect, it, vi } from 'vitest'
import { loadUiModule } from './test-ui'
import type PlayerActionButton from '../components/PlayerActionButton'

const Button = loadUiModule<{ default: typeof PlayerActionButton }>(new URL('../components/PlayerActionButton.tsx', import.meta.url), {}).default

it.each([
  ['add-player', '+ PLAYER', 'outline'],
  ['buy-in', '+ BUY IN', 'default'],
] as const)('preserves the %s action label, color, disabled state and click handler', (action, label, color) => {
  const onClick = vi.fn()
  const button = Button({ action, disabled: true, onClick, className: 'w-full' })
  expect(button.props.type).toBe('button')
  expect(button.props.children).toBe(label)
  expect(button.props.disabled).toBe(true)
  expect(button.props.onClick).toBe(onClick)
  expect(button.props.variant).toBe(color)
  expect(button.props.size).toBe('default')
  expect(button.props.className).toContain('w-full')
})

it('preserves the smaller group settings button dimensions', () => {
  const button = Button({ action: 'add-player', compact: true })
  expect(button.props.size).toBe('sm')
})
