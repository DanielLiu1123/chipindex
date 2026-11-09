// @vitest-environment jsdom
import { act, fireEvent, render, screen, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Nav from '../components/Nav'
const state = vi.hoisted(() => ({ pathname: '/' }))
const client = vi.hoisted(() => ({ logout: vi.fn(), push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ push: client.push, refresh: client.refresh }),
}))
vi.mock('./client', () => ({ listGroups: async () => [], logout: client.logout }))
beforeEach(() => {
  state.pathname = '/'
  Object.values(client).forEach(mock => mock.mockReset())
})
afterEach(cleanup)
it('waits for a group pathname before rendering group navigation', () => {
  state.pathname = '/'
  render(<Nav />)
  expect(screen.queryByRole('link', { name: 'LEADERBOARD' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'SESSIONS' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'MANAGE' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()
})
it('renders group navigation with the correct active destination', () => {
  state.pathname = '/groups/g1/sessions'
  render(<Nav />)
  expect(
    screen.getByRole('link', { name: 'LEADERBOARD' }).getAttribute('href'),
  ).toBe('/groups/g1')
  expect(
    screen.getByRole('link', { name: 'SESSIONS' }).getAttribute('aria-current'),
  ).toBe('page')
  expect(
    screen.getByRole('link', { name: 'MANAGE' }).getAttribute('href'),
  ).toBe('/groups/g1/settings')
})

it('shows pending logout, prevents repeat submissions, and returns to login', async () => {
  let resolve!: () => void
  client.logout.mockReturnValue(new Promise<void>(done => { resolve = done }))
  render(<Nav />)
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  const pending = screen.getByRole('button', { name: 'Signing out' }) as HTMLButtonElement
  expect(pending.disabled).toBe(true)
  expect(pending.getAttribute('aria-busy')).toBe('true')
  fireEvent.click(pending)
  expect(client.logout).toHaveBeenCalledTimes(1)
  await act(async () => resolve())
  expect(client.push).toHaveBeenCalledWith('/login')
  expect(client.refresh).toHaveBeenCalledTimes(1)
})
it('does not navigate when logout fails', async () => {
  render(<Nav />)
  client.logout.mockRejectedValue(new Error('Unable to connect.'))
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  await screen.findByText('Unable to connect.')
  expect(client.push).not.toHaveBeenCalled()
})
