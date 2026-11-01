// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import SessionForm from '../components/SessionForm'
import { importSession } from './client'
import type { Player } from './domain-types'

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => navigation }))
vi.mock('./client', async original => ({
  ...(await original<typeof import('./client')>()),
  importSession: vi.fn(),
}))
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('disables empty imports, restores the empty state after removal and imports signed net chips', async () => {
  const players: Player[] = ['Alice', 'Bob'].map(id => ({
    id, name: id, created_at: '', updated_at: '', deleted_at: null,
  }))
  render(<SessionForm groupId="g1" initialPlayers={players} />)
  const importButton = () => screen.getByRole('button', { name: 'IMPORT' }) as HTMLButtonElement
  expect(importButton().disabled).toBe(true)
  expect(screen.getByText('No players')).toBeTruthy()

  async function addPlayers(names: string[]) {
    fireEvent.click(screen.getByRole('button', { name: '+ PLAYER' }))
    const dialog = screen.getByRole('dialog')
    names.forEach(name => fireEvent.click(within(dialog).getByRole('checkbox', { name })))
    fireEvent.click(within(dialog).getByRole('button', { name: 'ADD' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  }
  await addPlayers(['Alice'])
  fireEvent.click(screen.getByRole('button', { name: 'remove Alice' }))
  expect(importButton().disabled).toBe(true)
  expect(screen.getByText('Add at least one player to import.')).toBeTruthy()

  await addPlayers(['Alice', 'Bob'])
  expect(screen.queryByText('No players')).toBeNull()
  fireEvent.change(screen.getByLabelText('net chips for Alice'), { target: { value: '-1000' } })
  fireEvent.change(screen.getByLabelText('net chips for Bob'), { target: { value: '1000' } })
  vi.mocked(importSession).mockResolvedValue({ id: 's1' })
  fireEvent.click(importButton())
  await waitFor(() => expect(importSession).toHaveBeenCalledWith('g1', expect.objectContaining({
    status: 'SETTLED', entries: [{ player_id: 'Alice', chips: -1000 }, { player_id: 'Bob', chips: 1000 }],
  })))
  expect(navigation.push).toHaveBeenCalledWith('/groups/g1/sessions')
})
