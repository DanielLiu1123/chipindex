// @vitest-environment jsdom
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Suspense, use, useState } from 'react'
import PlayerSessionHistory from '../components/PlayerSessionHistory'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
afterEach(() => { cleanup(); push.mockReset() })

const rows = [{ date: '2026-10-30', cny: 1, chips: 40, cumulative_cny: 1, cumulative: 40, session_id: 's1' }]
function setup() {
  return render(<PlayerSessionHistory groupId="g1" rows={rows} sessionsPath="/groups/g1/players/p1" page={2} pageSize={10} totalPages={9} />)
}

describe('player history client navigation', () => {
  it.each([
    ['Previous page', 1],
    ['Next page', 3],
    ['Go to page 4', 4],
  ])('navigates with %s without scrolling or replacing the current table', (label, page) => {
    setup()
    const table = screen.getByRole('table')
    fireEvent.click(screen.getByRole('link', { name: label }))
    expect(push).toHaveBeenCalledWith(`/groups/g1/players/p1?page=${page}&page_size=10`, { scroll: false })
    expect(screen.getByRole('table')).toBe(table)
  })

  it('keeps existing content and disables pagination until the new page is ready', async () => {
    let resolve!: () => void
    const ready = new Promise<void>(done => { resolve = done })
    function IncomingPage({ next }: { next: boolean }) {
      if (next) use(ready)
      return <PlayerSessionHistory groupId="g1" rows={next ? [{ ...rows[0], date: '2026-10-29' }] : rows} sessionsPath="/groups/g1/players/p1" page={next ? 3 : 2} pageSize={10} totalPages={9} />
    }
    function Profile() {
      const [next, setNext] = useState(false)
      push.mockImplementation(() => setNext(true))
      return <Suspense fallback={<p>Loading entire profile</p>}>
        <input aria-label="Chart state" defaultValue="CNY" />
        <IncomingPage next={next} />
      </Suspense>
    }
    render(<Profile />)
    const table = screen.getByRole('table')
    const chart = screen.getByRole('textbox', { name: 'Chart state' })
    fireEvent.change(chart, { target: { value: 'CHIPS' } })
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Next page' })) })
    expect(screen.getByRole('table')).toBe(table)
    expect(screen.getByRole('status').textContent).toContain('Loading session history')
    expect(screen.getByRole('region', { name: 'Session history' }).getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('navigation').parentElement?.parentElement?.hasAttribute('inert')).toBe(true)
    expect(screen.queryByText('Loading entire profile')).toBeNull()
    await act(async () => { resolve(); await ready })
    expect(screen.getByRole('link', { name: '2026-10-29' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Session history' }).getAttribute('aria-busy')).toBe('false')
    expect(screen.getByRole('textbox', { name: 'Chart state' })).toBe(chart)
    expect((chart as HTMLInputElement).value).toBe('CHIPS')
    push.mockReset()
  })

  it('submits GO through the router while preserving page size', () => {
    setup()
    const input = screen.getByRole('spinbutton', { name: 'Go to page' })
    fireEvent.change(input, { target: { value: '8' } })
    fireEvent.submit(input.closest('form')!)
    expect(push).toHaveBeenCalledWith('/groups/g1/players/p1?page=8&page_size=10', { scroll: false })
  })

  it('preserves native modified-click behavior and session detail links', () => {
    setup()
    const link = screen.getByRole('link', { name: 'Next page' })
    expect(link.getAttribute('href')).toBe('/groups/g1/players/p1?page=3&page_size=10')
    fireEvent.click(link, { ctrlKey: true })
    expect(push).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: '2026-10-30' }).getAttribute('href')).toBe('/groups/g1/sessions/s1')
  })
})
