// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import SessionEntriesTable from '../components/SessionEntriesTable'
import { localTime } from './browser-time'
afterEach(cleanup)
it('expands buy-in history with keyboard interaction and preserves local event times and totals', async () => {
  const times = ['2026-08-08T06:59:27', '2026-08-08T09:56:18']
  render(
    <SessionEntriesTable
      groupId="g1"
      entries={[
        {
          id: 'part-1',
          player_id: 'alice',
          chips: 1000,
          final_chips: 6000,
          total_buyin: 5000,
          buy_ins: times.map((created_at, i) => ({
            amount: 2000 + i * 1000,
            created_at,
          })),
          players: { name: 'Alice' },
        },
      ]}
      exchangeRate={40}
      total={1000}
    />,
  )
  const user = userEvent.setup()
  const toggle = screen.getByRole('button', { name: 'Alice buy-in history' })
  expect(screen.queryByText('BUY-INS')).toBeNull()
  toggle.focus()
  await user.keyboard('{Enter}')
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  times.forEach((time) =>
    expect(screen.getByText(localTime(time))).toBeTruthy(),
  )
  expect(screen.getByText('TOTAL').parentElement?.textContent).toContain(
    '5,000',
  )
  expect(screen.getByText('FINAL').parentElement?.textContent).toContain(
    '6,000',
  )
  await user.keyboard(' ')
  expect(screen.queryByText('BUY-INS')).toBeNull()
})
