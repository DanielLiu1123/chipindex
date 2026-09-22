// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LeaderboardView from '../components/LeaderboardView'
import type { Player } from './domain-types'

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: ReactNode }) =>
    createElement('a', props, children),
}))
vi.mock('../components/LeaderboardChart', () => ({
  default: (props: { data: unknown; mode: string }) =>
    createElement(
      'pre',
      { 'data-testid': 'leaderboard-chart' },
      JSON.stringify(props),
    ),
}))
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 0, 15, 12))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
const players: Player[] = ['Alice', 'Bob', 'Carol'].map((name) => ({
  id: name,
  name,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  deleted_at: null,
}))
function openOptions() {
  fireEvent.click(screen.getByRole('button', { name: /^Date range:/ }))
}
function openCustom() {
  openOptions()
  fireEvent.click(screen.getByRole('button', { name: 'CUSTOM…' }))
}
function day(date: string) {
  fireEvent.click(screen.getByRole('button', { name: date }))
}
function apply() {
  fireEvent.click(screen.getByRole('button', { name: 'APPLY' }))
}
const sessions = [
  {
    id: 'old',
    date: '2025-12-31',
    exchange_rate: 40,
    session_entries: [
      {
        player_id: 'Alice',
        chips: 4000,
        final_chips: 6000,
        total_buyin: 2000,
        buy_in_count: 1,
      },
    ],
  },
  {
    id: 'start',
    date: '2026-01-01',
    exchange_rate: 40,
    session_entries: [
      {
        player_id: 'Alice',
        chips: 400,
        final_chips: 2400,
        total_buyin: 2000,
        buy_in_count: 1,
      },
    ],
  },
  {
    id: 'end',
    date: '2026-01-31',
    exchange_rate: 20,
    session_entries: [
      {
        player_id: 'Alice',
        chips: -100,
        final_chips: 1900,
        total_buyin: 2000,
        buy_in_count: 1,
      },
    ],
  },
  {
    id: 'after',
    date: '2026-02-01',
    exchange_rate: 40,
    session_entries: [
      {
        player_id: 'Bob',
        chips: 8000,
        final_chips: 10000,
        total_buyin: 2000,
        buy_in_count: 1,
      },
    ],
  },
]
it('shares an applied calendar range between rankings and rebased CNY/chip curves', () => {
  render(<LeaderboardView groupId="g1" players={players} sessions={sessions} />)
  openCustom()
  day('2026-01-01')
  day('2026-01-31')
  expect(screen.getByRole('link', { name: 'Bob' })).toBeTruthy()
  apply()
  const row = screen.getByRole('link', { name: 'Alice' }).closest('tr')!
  expect(within(row).getByRole('link', { name: '+¥5' })).toBeTruthy()
  expect(within(row).getByRole('link', { name: '50%' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Bob' })).toBeNull()
  fireEvent.click(screen.getByRole('radio', { name: 'CHART' }))
  expect(
    JSON.parse(screen.getByTestId('leaderboard-chart').textContent!).data,
  ).toEqual([
    { date: '2026-01-01', Alice: 10 },
    { date: '2026-01-31', Alice: 5 },
  ])
  fireEvent.click(screen.getByRole('radio', { name: 'CHIPS' }))
  expect(
    JSON.parse(screen.getByTestId('leaderboard-chart').textContent!).data.map(
      (point: { Alice: number }) => point.Alice,
    ),
  ).toEqual([400, 300])
  openOptions()
  fireEvent.click(screen.getByRole('button', { name: 'ALL TIME' }))
  expect(
    JSON.parse(screen.getByTestId('leaderboard-chart').textContent!).data,
  ).toHaveLength(4)
})
it('applies presets and keeps the activity switch visible for empty periods', () => {
  render(<LeaderboardView groupId="g1" players={players} sessions={[]} />)
  const toggle = screen.getByRole('switch', {
    name: 'HIDE LOW-ACTIVITY PLAYERS',
  })
  for (const label of ['THIS MONTH', 'LAST MONTH', 'THIS YEAR']) {
    openOptions()
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(
      screen
        .getByRole('button', { name: `Date range: ${label}` })
        .getAttribute('aria-expanded'),
    ).toBe('false')
    expect(screen.getByRole('switch')).toBe(toggle)
    expect(screen.getByText('NO SESSIONS')).toBeTruthy()
  }
  fireEvent.click(toggle)
  expect(toggle.getAttribute('aria-checked')).toBe('false')
})
it('discards unapplied dates on Escape and outside interaction and returns focus', async () => {
  const user = userEvent.setup()
  render(<LeaderboardView groupId="g1" players={players} sessions={[]} />)
  openCustom()
  day('2026-01-10')
  day('2026-01-20')
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Date range: ALL TIME' }),
  )
  openCustom()
  day('2026-01-05')
  day('2026-01-06')
  await user.click(screen.getByRole('switch'))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(
    screen.getByRole('button', { name: 'Date range: ALL TIME' }),
  ).toBeTruthy()
})
it('Back discards the draft and custom ranges display compact same-year dates', () => {
  render(<LeaderboardView groupId="g1" players={players} sessions={[]} />)
  openCustom()
  day('2026-01-10')
  day('2026-01-20')
  fireEvent.click(screen.getByRole('button', { name: 'BACK' }))
  fireEvent.click(screen.getByRole('button', { name: 'CUSTOM…' }))
  apply()
  expect(
    screen.getByRole('button', { name: 'Date range: 2026-01-01–01-31' }),
  ).toBeTruthy()
})
it('keeps options mounted across a null-target touch blur before click', () => {
  render(<LeaderboardView groupId="g1" players={players} sessions={[]} />)
  openOptions()
  const option = screen.getByRole('button', { name: 'THIS MONTH' })
  fireEvent.pointerDown(option, { pointerType: 'touch' })
  fireEvent.mouseDown(option)
  fireEvent.blur(document.activeElement!, { relatedTarget: null })
  fireEvent.pointerUp(option, { pointerType: 'touch' })
  fireEvent.click(option)
  expect(
    screen.getByRole('button', { name: 'Date range: THIS MONTH' }),
  ).toBeTruthy()
})

it('starts a new custom range from the clicked date instead of keeping the old start', () => {
  render(<LeaderboardView groupId="g1" players={players} sessions={sessions} />)
  openCustom()
  day('2026-01-15')
  day('2026-01-20')
  apply()
  expect(screen.getByRole('button', { name: 'Date range: 2026-01-15–01-20' })).toBeTruthy()
})
