// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import EditSessionForm from '../components/EditSessionForm'
import { updateSession } from './client'
import type { Player, SessionForEdit } from './domain-types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('./client', async original => ({ ...(await original<typeof import('./client')>()), updateSession: vi.fn() }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
const players: Player[] = ['Alice', 'Bob'].map(id => ({ id, name: id, created_at: '', updated_at: '', deleted_at: null }))
const session: SessionForEdit = { date: '2026-11-07', exchange_rate: 40, description: null, status: 'SETTLED', ended_at: '2026-11-07T14:00:00Z', participants: [{ player_id: 'Alice', name: 'Alice', final_chips: 2000, buy_ins: [{ id: 'buy1', amount: 2000, created_at: '2026-11-07T12:00:00.123Z' }] }] }
const mount = () => render(<EditSessionForm groupId="g" sessionId="s" session={session} initialPlayers={players} />)

it('expands from the player row without toggling when editing final chips, and preserves original timestamps', async () => {
  mount()
  fireEvent.click(screen.getByText('Alice'))
  const toggle = screen.getByRole('button', { name: 'Buy-ins for Alice' })
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  fireEvent.click(screen.getByLabelText('final chips for Alice'))
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  expect(screen.getAllByLabelText('final chips for Alice')).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'SAVE CHANGES' }))
  await waitFor(() => expect(updateSession).toHaveBeenCalled())
  expect(vi.mocked(updateSession).mock.calls[0][2].participants![0].buy_ins[0]).toEqual(session.participants![0].buy_ins[0])
})

it('adds players without chips and lets users record buy-ins after expanding', async () => {
  mount()
  fireEvent.click(screen.getByRole('button', { name: '+ PLAYER' }))
  const dialog = screen.getByRole('dialog')
  expect(within(dialog).queryByRole('spinbutton')).toBeNull()
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Bob' }))
  fireEvent.click(within(dialog).getByRole('button', { name: /^ADD$/ }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect((screen.getByLabelText('final chips for Bob') as HTMLInputElement).value).toBe('')
  fireEvent.click(screen.getByText('Bob'))
  expect(screen.queryByLabelText('buy-in chips for Bob')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /^ADD$/ }))
  fireEvent.change(screen.getByLabelText('buy-in chips for Bob'), { target: { value: '1000' } })
  fireEvent.change(screen.getByLabelText('final chips for Bob'), { target: { value: '1000' } })
  fireEvent.click(screen.getByRole('button', { name: 'SAVE CHANGES' }))
  await waitFor(() => expect(updateSession).toHaveBeenCalled())
  expect(vi.mocked(updateSession).mock.calls[0][2].participants![1]).toMatchObject({ player_id: 'Bob', final_chips: 1000, buy_ins: [{ amount: 1000 }] })
})

it('rejects invalid calendar dates before saving', () => {
  mount()
  fireEvent.click(screen.getByText('Alice'))
  fireEvent.change(screen.getByLabelText('buy-in time for Alice'), { target: { value: '2026-02-30 12:00:00' } })
  fireEvent.click(screen.getByRole('button', { name: 'SAVE CHANGES' }))
  expect(updateSession).not.toHaveBeenCalled()
  expect(screen.getByRole('alert').textContent).toContain('valid time')
})
