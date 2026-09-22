// @vitest-environment jsdom
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import PlayerActionButton from '../components/PlayerActionButton'
afterEach(cleanup)
it.each([
  ['add-player', '+ PLAYER'],
  ['buy-in', '+ BUY IN'],
] as const)(
  'preserves the %s label and disabled interaction',
  (action, name) => {
    const click = vi.fn()
    const view = render(
      <PlayerActionButton action={action} disabled onClick={click} />,
    )
    const button = screen.getByRole('button', { name }) as HTMLButtonElement
    expect(button.type).toBe('button')
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(click).not.toHaveBeenCalled()
    view.rerender(<PlayerActionButton action={action} onClick={click} />)
    fireEvent.click(button)
    expect(click).toHaveBeenCalledOnce()
  },
)
