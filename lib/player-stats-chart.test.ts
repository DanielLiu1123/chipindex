// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import PlayerStatsChart from '../components/PlayerStatsChart'
import type { HistoryPoint } from './stats'

vi.mock('../components/PlayerChart', () => ({
  default: (props: { mode: string }) =>
    createElement('div', { 'data-testid': 'chart' }, props.mode),
}))
vi.mock('../components/PlayerNameEditor', () => ({ default: () => null }))
afterEach(cleanup)
const point = { date: '2026-01-01' } as HistoryPoint
function mount(data: HistoryPoint[]) {
  return render(
    createElement(PlayerStatsChart, {
      groupId: 'g1',
      id: 'p1',
      initialName: 'Ada',
      data,
      totalCny: -12.5,
      totalChips: 500,
      sessions: data.length,
      wins: 1,
      pogCount: 1,
    }),
  )
}
it('shows a single point with accessible currency controls and totals', () => {
  mount([point])
  expect(screen.getByTestId('chart').textContent).toBe('cny')
  expect(screen.getByText('-¥12.5')).toBeTruthy()
  expect(
    screen.getByRole('radio', { name: 'CNY' }).getAttribute('aria-checked'),
  ).toBe('true')
})
it('switches both chart units and summary totals', () => {
  mount([point])
  fireEvent.click(screen.getByRole('radio', { name: 'CHIPS' }))
  expect(screen.getByTestId('chart').textContent).toBe('chips')
  expect(screen.getByText('+500')).toBeTruthy()
  expect(
    screen.getByRole('radio', { name: 'CHIPS' }).getAttribute('aria-checked'),
  ).toBe('true')
})
it('omits the chart and unit controls without history', () => {
  mount([])
  expect(screen.queryByTestId('chart')).toBeNull()
  expect(screen.queryByRole('radiogroup')).toBeNull()
})
