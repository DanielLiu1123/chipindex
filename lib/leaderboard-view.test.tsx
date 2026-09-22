// @vitest-environment jsdom
import { createElement, type ReactNode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LeaderboardView from '../components/LeaderboardView'
import type { Player } from './domain-types'

vi.mock('next/link', () => ({ default: ({ children, ...props }: { children: ReactNode }) => createElement('a', props, children) }))
vi.mock('../components/LeaderboardChart', () => ({ default: (props: { data: unknown; mode: string }) => createElement('pre', { 'data-testid': 'leaderboard-chart' }, JSON.stringify(props)) }))

afterEach(() => { cleanup(); vi.useRealTimers() })
const players: Player[] = ['Alice', 'Bob', 'Carol'].map(name => ({ id: name, name, created_at: '2026-01-01', updated_at: '2026-01-01', deleted_at: null }))

function openOptions() {
  fireEvent.click(screen.getByRole('button', { name: /^Date range:/ }))
}
function openCustom() {
  openOptions()
  fireEvent.click(screen.getByRole('button', { name: 'CUSTOM…' }))
}

it('shares the date range between rankings and rebased CNY/chip curves, and validates custom dates', () => {
  const sessions = [
    { id: 'old', date: '2025-12-31', exchange_rate: 40, session_entries: [{ player_id: 'Alice', chips: 4000, final_chips: 6000, total_buyin: 2000, buy_in_count: 1 }] },
    { id: 'start', date: '2026-01-01', exchange_rate: 40, session_entries: [{ player_id: 'Alice', chips: 400, final_chips: 2400, total_buyin: 2000, buy_in_count: 1 }] },
    { id: 'end', date: '2026-01-31', exchange_rate: 20, session_entries: [{ player_id: 'Alice', chips: -100, final_chips: 1900, total_buyin: 2000, buy_in_count: 1 }] },
    { id: 'after', date: '2026-02-01', exchange_rate: 40, session_entries: [{ player_id: 'Bob', chips: 8000, final_chips: 10000, total_buyin: 2000, buy_in_count: 1 }] },
  ]
  render(<LeaderboardView groupId="g1" players={players} sessions={sessions} />)
  openCustom()
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-01' } })
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-01-31' } })
  expect(screen.getByRole('link', { name: 'Bob' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'APPLY' }))
  expect(screen.queryByRole('dialog')).toBeNull()
  const row = screen.getByRole('link', { name: 'Alice' }).closest('tr')!
  expect(within(row).getByRole('link', { name: '+¥5' })).toBeTruthy()
  expect(within(row).getByRole('link', { name: '50%' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Bob' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'CHART' }))
  let chart = JSON.parse(screen.getByTestId('leaderboard-chart').textContent!)
  expect(chart.data).toEqual([{ date: '2026-01-01', Alice: 10 }, { date: '2026-01-31', Alice: 5 }])
  fireEvent.click(screen.getByRole('button', { name: 'CHIPS' }))
  chart = JSON.parse(screen.getByTestId('leaderboard-chart').textContent!)
  expect(chart.data.map((point: { Alice: number }) => point.Alice)).toEqual([400, 300])
  openCustom()
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-02-02' } })
  expect(screen.getByRole('alert').textContent).toContain('Start date must')
  expect(JSON.parse(screen.getByTestId('leaderboard-chart').textContent!).data).toHaveLength(2)
  expect((screen.getByRole('button', { name: 'APPLY' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '' } })
  expect(screen.getByRole('alert').textContent).toContain('Choose a valid')
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-02-03' } })
  fireEvent.click(screen.getByRole('button', { name: 'APPLY' }))
  expect(screen.getByText('NO SESSIONS')).toBeTruthy()
  openOptions()
  fireEvent.click(screen.getByRole('button', { name: 'ALL TIME' }))
  expect(JSON.parse(screen.getByTestId('leaderboard-chart').textContent!).data).toHaveLength(4)
})

it('switches presets atomically and keeps the activity toggle visible without hidden players', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 0, 15))
  render(<LeaderboardView groupId="g1" players={players} sessions={[]} />)
  const activityToggle = screen.getByRole('button', { name: 'HIDE LOW-ACTIVITY PLAYERS' })
  expect(screen.getByText('SHOWING ALL 3 PLAYERS')).toBeTruthy()
  for (const [label, start, end] of [
    ['THIS MONTH', '2026-01-01', '2026-01-31'],
    ['LAST MONTH', '2025-12-01', '2025-12-31'],
    ['THIS YEAR', '2026-01-01', '2026-12-31'],
  ]) {
    openOptions()
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(screen.getByRole('button', { name: `Date range: ${label}` }).getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('button', { name: 'HIDE LOW-ACTIVITY PLAYERS' })).toBe(activityToggle)
    expect(screen.getByText('SHOWING ALL 0 PLAYERS')).toBeTruthy()
    openCustom()
    expect((screen.getByLabelText('Start date') as HTMLInputElement).value).toBe(start)
    expect((screen.getByLabelText('End date') as HTMLInputElement).value).toBe(end)
    fireEvent.keyDown(screen.getByLabelText('End date'), { key: 'Escape' })
  }
  openCustom()
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '' } })
  expect(screen.getByRole('alert')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'BACK' }))
  fireEvent.click(screen.getByRole('button', { name: 'THIS MONTH' }))
  expect(screen.queryByRole('alert')).toBeNull()
  fireEvent.click(activityToggle)
  expect(activityToggle.getAttribute('aria-pressed')).toBe('false')
  openOptions()
  fireEvent.click(screen.getByRole('button', { name: 'ALL TIME' }))
  expect(screen.getByText('SHOWING ALL 3 PLAYERS')).toBeTruthy()
})

it('discards drafts on outside click and Escape, and displays same-year and cross-year dates', () => {
  render(<LeaderboardView groupId="g1" players={players} sessions={[]} />)
  openCustom()
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2025-12-01' } })
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-01-31' } })
  fireEvent.click(screen.getByRole('button', { name: 'APPLY' }))
  expect(screen.getByRole('button', { name: 'Date range: 2025-12-01–2026-01-31' })).toBeTruthy()
  openCustom()
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-01' } })
  fireEvent.pointerDown(document.body)
  expect(screen.queryByRole('dialog')).toBeNull()
  openCustom()
  expect((screen.getByLabelText('Start date') as HTMLInputElement).value).toBe('2025-12-01')
  fireEvent.keyDown(screen.getByLabelText('Start date'), { key: 'Escape' })
  expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Date range:/ }))
  openCustom()
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-01' } })
  fireEvent.click(screen.getByRole('button', { name: 'APPLY' }))
  expect(screen.getByRole('button', { name: 'Date range: 2026-01-01–01-31' })).toBeTruthy()
})

it('discards drafts on Back and keyboard dismissal without moving focus back from the next control', async () => {
  const user = userEvent.setup()
  render(<LeaderboardView groupId="g1" players={players} sessions={[]} />)
  openCustom()
  const originalStart = (screen.getByLabelText('Start date') as HTMLInputElement).value
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2020-01-01' } })
  fireEvent.click(screen.getByRole('button', { name: 'BACK' }))
  fireEvent.click(screen.getByRole('button', { name: 'CUSTOM…' }))
  expect((screen.getByLabelText('Start date') as HTMLInputElement).value).toBe(originalStart)
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2020-01-01' } })
  screen.getByRole('button', { name: 'APPLY' }).focus()
  await user.tab()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'HIDE LOW-ACTIVITY PLAYERS' }))
  expect(screen.getByRole('button', { name: 'Date range: ALL TIME' })).toBeTruthy()
  openCustom()
  expect((screen.getByLabelText('Start date') as HTMLInputElement).value).toBe(originalStart)
})

// Replay WebKit's touch order: the focused control blurs with no relatedTarget
// before click; tapping the next button does not first move focus to it.
function tapWithoutFocus(button: HTMLElement) {
  fireEvent.pointerDown(button, { pointerType: 'touch' })
  fireEvent.mouseDown(button)
  if (document.activeElement instanceof HTMLElement) {
    fireEvent.blur(document.activeElement, { relatedTarget: null })
  }
  fireEvent.pointerUp(button, { pointerType: 'touch' })
  fireEvent.mouseUp(button)
  fireEvent.click(button)
}

it('applies presets and custom ranges when touch blurs the current control before click', () => {
  render(<LeaderboardView groupId="g1" players={players} sessions={[]} />)
  openOptions()
  tapWithoutFocus(screen.getByRole('button', { name: 'THIS MONTH' }))
  expect(screen.getByRole('button', { name: 'Date range: THIS MONTH' })).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()

  openOptions()
  tapWithoutFocus(screen.getByRole('button', { name: 'CUSTOM…' }))
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-01' } })
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-01-31' } })
  tapWithoutFocus(screen.getByRole('button', { name: 'APPLY' }))
  expect(screen.getByRole('button', { name: 'Date range: 2026-01-01–01-31' })).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()

  openCustom()
  tapWithoutFocus(screen.getByRole('button', { name: 'BACK' }))
  expect(screen.getByRole('button', { name: 'ALL TIME' })).toBeTruthy()
  tapWithoutFocus(screen.getByRole('button', { name: 'ALL TIME' }))
  expect(screen.getByRole('button', { name: 'Date range: ALL TIME' })).toBeTruthy()
})
