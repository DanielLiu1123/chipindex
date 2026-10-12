// @vitest-environment jsdom
import { createElement } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import LeaderboardChart from '../components/LeaderboardChart'

// Exercise the actual Recharts axis and tooltip selectors: duplicated dates
// must still resolve each session's own cumulative value.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 800, 400))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it.each(['cny', 'chips'] as const)('shows distinct tooltip values for same-day sessions in %s mode', async mode => {
  const { container, getByRole } = render(createElement(LeaderboardChart, {
    data: [
      { session_id: 'first', date: '2026-10-04', player: 100 },
      { session_id: 'last', date: '2026-10-04', player: 300 },
    ],
    players: [{ id: 'player', name: 'Player' }],
    mode,
  }))
  const surface = getByRole('application')
  fireEvent.focus(surface)
  await waitFor(() => {
    expect(container.querySelector('.recharts-tooltip-wrapper')?.textContent).toContain(mode === 'cny' ? '¥100' : '+100')
  })
  fireEvent.keyDown(surface, { key: 'ArrowRight' })
  await waitFor(() => {
    const tooltipText = container.querySelector('.recharts-tooltip-wrapper')?.textContent
    expect(tooltipText).toContain(mode === 'cny' ? '¥300' : '+300')
    expect(tooltipText).toContain('2026-10-04')
    expect(tooltipText).not.toContain('last')
  })
  fireEvent.keyDown(surface, { key: 'ArrowLeft' })
  await waitFor(() => {
    expect(container.querySelector('.recharts-tooltip-wrapper')?.textContent).toContain(mode === 'cny' ? '¥100' : '+100')
  })
})
