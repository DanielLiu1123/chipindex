// @vitest-environment jsdom
import { createElement, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderToString } from 'react-dom/server'
import { hydrateRoot } from 'react-dom/client'
import LeaderboardView from '../components/LeaderboardView'
import type { Player } from './domain-types'

// Model Next's search-param subscription; native replaceState does not emit popstate.
vi.mock('next/navigation', () => ({
  useSearchParams: () => {
    const search = useSyncExternalStore(
      notify => {
        window.addEventListener('popstate', notify)
        window.addEventListener('test:search-params', notify)
        return () => {
          window.removeEventListener('popstate', notify)
          window.removeEventListener('test:search-params', notify)
        }
      },
      () => window.location.search,
      () => window.location.search,
    )
    return useMemo(() => new URLSearchParams(search), [search])
  },
}))
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
  window.history.replaceState(null, '', '/groups/g1')
  const replaceState = window.history.replaceState.bind(window.history)
  vi.spyOn(window.history, 'replaceState').mockImplementation((...args) => {
    replaceState(...args)
    window.dispatchEvent(new Event('test:search-params'))
  })
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 0, 15, 12))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
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
    ended_at: null,
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
    ended_at: null,
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
    ended_at: null,
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
    ended_at: null,
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
  fireEvent.click(screen.getByRole('radio', { name: 'Chart' }))
  expect(
    JSON.parse(screen.getByTestId('leaderboard-chart').textContent!).data,
  ).toEqual([
    { session_id: 'start', date: '2026-01-01', Alice: 10 },
    { session_id: 'end', date: '2026-01-31', Alice: 5 },
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
    name: 'Active only',
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
it('closing the calendar discards its draft and custom ranges display compact same-year dates', async () => {
  const user = userEvent.setup()
  render(<LeaderboardView groupId="g1" players={players} sessions={[]} />)
  openCustom()
  day('2026-01-10')
  day('2026-01-20')
  expect(screen.queryByRole('button', { name: 'BACK' })).toBeNull()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  openCustom()
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

it('restores only date and activity filters after leaving for a player and returning', async () => {
  const user = userEvent.setup()
  const initialHistoryLength = window.history.length
  const board = render(<LeaderboardView groupId="g1" players={players} sessions={sessions} />)
  openOptions()
  fireEvent.click(screen.getByRole('button', { name: 'THIS MONTH' }))
  fireEvent.click(screen.getByRole('switch'))
  expect(window.location.search).toBe('?period=month&active=0')
  expect(window.history.length).toBe(initialHistoryLength)
  fireEvent.click(screen.getByRole('radio', { name: 'Chart' }))
  fireEvent.click(screen.getByRole('radio', { name: 'CHIPS' }))
  const leaderboardUrl = window.location.href
  board.unmount()
  window.history.pushState(null, '', '/groups/g1/players/Alice')
  window.history.back()
  await waitFor(() => expect(window.location.href).toBe(leaderboardUrl))
  render(<LeaderboardView groupId="g1" players={players} sessions={sessions} />)
  expect(screen.getByRole('button', { name: 'Date range: THIS MONTH' })).toBeTruthy()
  expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false')
  expect(screen.getByRole('radio', { name: 'Table' }).getAttribute('aria-checked')).toBe('true')
  await user.click(screen.getByRole('radio', { name: 'Chart' }))
  expect(screen.getByRole('radio', { name: 'CNY' }).getAttribute('aria-checked')).toBe('true')
})

it('restores a custom range on reload and updates mounted filters on history navigation', () => {
  act(() => window.history.replaceState(null, '', '/groups/g1?period=custom&start=2026-01-01&end=2026-01-31&active=0'))
  render(<LeaderboardView groupId="g1" players={players} sessions={sessions} />)
  expect(screen.getByRole('button', { name: 'Date range: 2026-01-01–01-31' })).toBeTruthy()
  expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false')
  act(() => window.history.replaceState(null, '', '/groups/g1'))
  expect(screen.getByRole('button', { name: 'Date range: ALL TIME' })).toBeTruthy()
  expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true')
})

it.each(['month', 'last-month', 'year'])('defers %s until hydration and uses the browser date without a mismatch', async period => {
  window.history.replaceState(null, '', `/groups/g1?period=${period}`)
  const decemberSessions = [{ ...sessions[0], date: '2026-12-31' }]
  const view = <LeaderboardView groupId="g1" players={players} sessions={decemberSessions} />
  // Advance across both a month and a year between SSR and browser hydration.
  vi.setSystemTime(new Date(2026, 11, 31, 23, 30))
  const serverHtml = renderToString(view)
  expect(serverHtml).toContain('Loading leaderboard')
  expect(serverHtml).not.toContain('Alice')
  vi.setSystemTime(new Date(2027, 0, 1, 7, 30))
  const container = document.createElement('div')
  document.body.appendChild(container)
  container.innerHTML = serverHtml
  const onRecoverableError = vi.fn()
  const root = hydrateRoot(container, view, { onRecoverableError })
  try {
    await waitFor(() => expect(within(container).queryByRole('status', { name: 'Loading leaderboard' })).toBeNull())
    expect(onRecoverableError).not.toHaveBeenCalled()
    // Only last month (December 2026) overlaps our fixtures; month/year are 2027.
    expect(Boolean(within(container).queryByText('NO SESSIONS'))).toBe(period !== 'last-month')
  } finally {
    act(() => root.unmount())
    container.remove()
  }
})

it('keeps all-time and custom filters server-rendered', () => {
  for (const query of ['', '?period=custom&start=2026-01-01&end=2026-01-31']) {
    window.history.replaceState(null, '', `/groups/g1${query}`)
    const html = renderToString(<LeaderboardView groupId="g1" players={players} sessions={sessions} />)
    expect(html).not.toContain('Loading leaderboard')
    expect(html).toContain('Alice')
  }
})
