// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import PlayerHistoryFilters from '../components/PlayerHistoryFilters'

const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
afterEach(() => { cleanup(); push.mockClear() })

it('previews the intersection, switches a player from include to exclude, and applies from page one', () => {
  render(<PlayerHistoryFilters path="/groups/g1/players/p1" pageSize={5}
    date={{ period: 'custom', range: { start: '2026-08-01', end: '2026-08-31' } }}
    attendance={{ p2: 'include' }}
    players={[{ id: 'p2', name: 'Ada' }, { id: 'p3', name: 'Max' }, { id: 'p4', name: 'Kim' }]}
    lineups={[[ 'p2', 'p3' ], [ 'p2', 'p3', 'p4' ], [ 'p2' ]]} />)

  fireEvent.click(screen.getByRole('button', { name: /filter players/i }))
  const dialog = within(screen.getByRole('dialog'))
  fireEvent.click(dialog.getByRole('checkbox', { name: 'Include Max' }))
  fireEvent.click(dialog.getByRole('checkbox', { name: 'Include Kim' }))
  expect(dialog.getByRole('checkbox', { name: 'Include Kim' }).getAttribute('aria-checked')).toBe('true')
  fireEvent.click(dialog.getByRole('checkbox', { name: 'Exclude Kim' }))
  expect(dialog.getByRole('checkbox', { name: 'Include Kim' }).getAttribute('aria-checked')).toBe('false')
  fireEvent.click(dialog.getByRole('button', { name: 'APPLY · 1 SESSION' }))

  expect(push).toHaveBeenCalledOnce()
  expect(push).toHaveBeenCalledWith(
    '/groups/g1/players/p1?period=custom&from=2026-08-01&to=2026-08-31&include=p2&include=p3&exclude=p4&page=1&page_size=5',
    { scroll: false },
  )
})
