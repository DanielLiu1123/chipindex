import { expect, it, vi } from 'vitest'
import { loadUiModule } from './test-ui'
import type PlayerActionButton from '../components/PlayerActionButton'

const Button = loadUiModule<{ default: typeof PlayerActionButton }>(new URL('../components/PlayerActionButton.tsx', import.meta.url), {}).default

it.each([
  ['add-player', '+ PLAYER', 'sky'],
  ['buy-in', '+ BUY IN', 'emerald'],
] as const)('preserves the %s action label, color, disabled state and click handler', (action, label, color) => {
  const onClick = vi.fn()
  const button = Button({ action, disabled: true, onClick, className: 'w-full' })
  expect(button.props.type).toBe('button')
  expect(button.props.children).toBe(label)
  expect(button.props.disabled).toBe(true)
  expect(button.props.onClick).toBe(onClick)
  expect(button.props.className).toContain(`text-${color}-300`)
  expect(button.props.className).toContain('px-3 py-3')
  expect(button.props.className).toContain('w-full')
})

it('preserves the smaller group settings button dimensions', () => {
  const button = Button({ action: 'add-player', compact: true })
  expect(button.props.className).toContain('shrink-0 px-4 py-2.5')
  expect(button.props.className).not.toContain('px-3 py-3')
})
