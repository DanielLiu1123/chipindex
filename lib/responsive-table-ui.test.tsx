// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import SessionEntriesTable from '../components/SessionEntriesTable'
import PlayerSessionHistoryTable from '../components/PlayerSessionHistoryTable'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function viewport(initial: number) {
  let width = initial
  let resize = () => {}
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ font: '', measureText: (text: string) => ({ width: text.length * 7 }) } as unknown as CanvasRenderingContext2D)
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback } observe() {} disconnect() {} })
  return (next: number) => act(() => { width = next; resize() })
}
it('preserves hidden chips in expansion and the unbalanced total through resizing', () => {
  const resize = viewport(280)
  render(<SessionEntriesTable groupId="g1" entries={[{ id: 'e1', player_id: 'p1', players: { name: 'Christopher Alexander' }, chips: 1000, total_buyin: 2000, final_chips: 3000, buy_ins: [] }]} exchangeRate={40} total={1000} />)
  expect(screen.queryByRole('columnheader', { name: 'CHIPS' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /buy-in history/ }))
  expect(document.querySelector('tbody tr:nth-child(2)')?.textContent).toContain('CHIPS +1,000')
  expect(document.querySelector('tfoot td')?.getAttribute('colspan')).toBe('2')
  expect(document.querySelector('tfoot')?.textContent).toContain('SUM · +1,000 CHIPS')
  resize(900)
  expect(screen.getByRole('columnheader', { name: 'CHIPS' })).toBeTruthy()
  expect(document.querySelector('tfoot td')?.getAttribute('colspan')).toBe('3')
})
it('recalculates history after new data and handles the empty-state span', () => {
  const resize = viewport(280)
  const view = render(<PlayerSessionHistoryTable groupId="g1" rows={[]} />)
  expect(document.querySelector('tbody td')?.getAttribute('colspan')).toBe('2')
  resize(900)
  expect(screen.getAllByRole('columnheader')).toHaveLength(5)
  view.rerender(<PlayerSessionHistoryTable groupId="g1" rows={[{ date: '2026-11-07', cny: 100, chips: 4000, cumulative_cny: 100, cumulative: 4000, session_id: 's1' }]} />)
  expect(screen.getByText('2026-11-07').getAttribute('href')).toBe('/groups/g1/sessions/s1')
  resize(280)
  expect(screen.getAllByRole('columnheader')).toHaveLength(2)
})
