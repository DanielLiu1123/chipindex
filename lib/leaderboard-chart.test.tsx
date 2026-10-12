// @vitest-environment jsdom
import { createElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import LeaderboardChart from '../components/LeaderboardChart'

// Exercise the actual Recharts axis and tooltip selectors: duplicated dates
// must still resolve each session's own cumulative value.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 800, height: 400, top: 0, left: 0, right: 800, bottom: 400, x: 0, y: 0, toJSON: () => ({}),
  })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it.each(['cny', 'chips'] as const)('shows distinct tooltip values for same-day sessions in %s mode', async mode => {
  const { container } = render(createElement(LeaderboardChart, {
    data: [
      { session_id: 'first', date: '2026-10-04', player: 100 },
      { session_id: 'last', date: '2026-10-04', player: 300 },
    ],
    players: [{ id: 'player', name: 'Player' }],
    mode,
  }))
  const surface = container.querySelector('.recharts-surface')!
  expect(surface).not.toBeNull()
  fireEvent.focus(surface)
  await waitFor(() => {
    expect(container.querySelector('.recharts-tooltip-wrapper')?.textContent).toContain(mode === 'cny' ? '¥100' : '+100')
  })
  fireEvent.keyDown(surface, { key: 'ArrowRight' })
  await waitFor(() => {
    const tooltip = container.querySelector('.recharts-tooltip-wrapper')!
    expect(tooltip.textContent).toContain(mode === 'cny' ? '¥300' : '+300')
    expect(tooltip.textContent).toContain('2026-10-04')
    expect(tooltip.textContent).not.toContain('last')
  })
  fireEvent.keyDown(surface, { key: 'ArrowLeft' })
  await waitFor(() => {
    expect(container.querySelector('.recharts-tooltip-wrapper')?.textContent).toContain(mode === 'cny' ? '¥100' : '+100')
  })
})
