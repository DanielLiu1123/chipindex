// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import Nav from '../components/Nav'
const state = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('./client', () => ({ listGroups: async () => [], logout: vi.fn() }))
afterEach(cleanup)
it('waits for a group pathname before rendering group navigation', () => {
  state.pathname = '/'
  render(<Nav />)
  expect(screen.queryByRole('link', { name: 'LEADERBOARD' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'SESSIONS' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'MANAGE' })).toBeNull()
  expect(screen.getByRole('button', { name: 'EXIT' })).toBeTruthy()
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
