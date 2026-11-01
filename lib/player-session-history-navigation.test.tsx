// @vitest-environment jsdom
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Suspense, use, useState } from 'react'
import PlayerSessionHistory from '../components/PlayerSessionHistory'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
afterEach(() => { cleanup(); push.mockReset() })

const rows = [{ date: '2026-10-30', cny: 1, chips: 40, cumulative_cny: 1, cumulative: 40, session_id: 's1' }]
function setup(page = 2) {
  return render(<PlayerSessionHistory groupId="g1" rows={rows} sessionsPath="/groups/g1/players/p1" page={page} pageSize={10} totalPages={9} />)
}

describe('player history client navigation', () => {
  it.each([
    ['Previous page', 1],
    ['Next page', 3],
    ['Go to page 4', 4],
  ])('navigates with %s without scrolling', (label, page) => {
    setup()
    fireEvent.click(screen.getByRole('link', { name: label }))
    expect(push).toHaveBeenCalledWith(`/groups/g1/players/p1?page=${page}&page_size=10`, { scroll: false })
  })

  it('replaces only history with a skeleton and disables pagination until the new page is ready', async () => {
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
    const chart = screen.getByRole('textbox', { name: 'Chart state' })
    fireEvent.change(chart, { target: { value: 'CHIPS' } })
    await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Next page' })) })
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('link', { name: '2026-10-30' })).toBeNull()
    expect(screen.getByRole('status', { name: 'Loading session history' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Session history' }).getAttribute('aria-busy')).toBe('true')
    expect(Boolean(screen.getByRole('navigation').closest('[inert]'))).toBe(true)
    expect(screen.queryByText('Loading entire profile')).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: 'Next page' }))
    expect(push).toHaveBeenCalledTimes(1)
    await act(async () => { resolve(); await ready })
    expect(screen.getByRole('link', { name: '2026-10-29' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('region', { name: 'Session history' }).getAttribute('aria-busy')).toBe('false')
    expect(screen.getByRole('textbox', { name: 'Chart state' })).toBe(chart)
    expect((chart as HTMLInputElement).value).toBe('CHIPS')
  })

  it('submits GO through the router while preserving page size', () => {
    setup()
    const input = screen.getByRole('spinbutton', { name: 'Go to page' })
    fireEvent.change(input, { target: { value: '8' } })
    fireEvent.submit(input.closest('form')!)
    expect(push).toHaveBeenCalledWith('/groups/g1/players/p1?page=8&page_size=10', { scroll: false })
  })

  it.each([[1, 'Previous page'], [9, 'Next page']] as const)('does not navigate past page %s', (page, label) => {
    setup(page)
    const link = screen.getByLabelText(label)
    expect(link.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(link)
    expect(push).not.toHaveBeenCalled()
  })

  it.each(['', '0', '10', '1.5'])('ignores invalid GO value "%s"', value => {
    setup()
    const input = screen.getByRole('spinbutton', { name: 'Go to page' })
    fireEvent.change(input, { target: { value } })
    fireEvent.submit(input.closest('form')!)
    expect(push).not.toHaveBeenCalled()
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
