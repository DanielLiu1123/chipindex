// @vitest-environment jsdom
import { act, fireEvent, render, screen, cleanup, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import Nav from '../components/Nav'
import userEvent from '@testing-library/user-event'
const state = vi.hoisted(() => ({ pathname: '/' }))
const client = vi.hoisted(() => ({ logout: vi.fn(), push: vi.fn(), refresh: vi.fn(), listGroups: vi.fn() }))
vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ push: client.push, refresh: client.refresh }),
}))
vi.mock('./client', () => ({ listGroups: client.listGroups, logout: client.logout }))
beforeEach(() => {
  state.pathname = '/'
  Object.values(client).forEach(mock => mock.mockReset())
  client.listGroups.mockResolvedValue([])
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

it('does not restore trigger focus after pointer selection', async () => {
  const user = userEvent.setup()
  client.listGroups.mockResolvedValue([{ id: 'g1', name: 'Group one' }, { id: 'g2', name: 'Group two' }])
  state.pathname = '/groups/g1'
  render(<Nav />)
  const trigger = screen.getByRole('combobox', { name: 'Current group' })
  await screen.findByText('Group one')
  await user.click(trigger)
  await user.click(await screen.findByRole('option', { name: 'Group two' }))
  await screen.findByRole('combobox', { expanded: false })
  expect(client.push).toHaveBeenCalledWith('/groups/g2')
  expect(document.activeElement).not.toBe(trigger)
})

it('restores trigger focus after keyboard selection', async () => {
  const user = userEvent.setup()
  client.listGroups.mockResolvedValue([{ id: 'g1', name: 'Group one' }, { id: 'g2', name: 'Group two' }])
  state.pathname = '/groups/g1'
  render(<Nav />)
  const trigger = screen.getByRole('combobox', { name: 'Current group' })
  await screen.findByText('Group one')
  trigger.focus()
  await user.keyboard('{Enter}')
  await screen.findByRole('option', { name: 'Group two' })
  await user.keyboard('{ArrowDown}{Enter}')
  await screen.findByRole('combobox', { expanded: false })
  expect(client.push).toHaveBeenCalledWith('/groups/g2')
  await waitFor(() => expect(document.activeElement).toBe(trigger))
})

it('restores focus when a pointer-opened menu is dismissed with Escape', async () => {
  const user = userEvent.setup()
  state.pathname = '/groups/g1'
  render(<Nav />)
  const trigger = screen.getByRole('combobox', { name: 'Current group' })
  await user.click(trigger)
  await screen.findByRole('option', { name: '+ NEW GROUP' })
  await user.keyboard('{Escape}')
  await waitFor(() => expect(document.activeElement).toBe(trigger))
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
})
