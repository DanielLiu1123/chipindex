// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import LoginPage from '../app/login/page'

const { login, push, refresh } = vi.hoisted(() => ({ login: vi.fn(), push: vi.fn(), refresh: vi.fn() }))
vi.mock('./client', () => ({ login }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams('next=/groups/g1/sessions'),
}))
afterEach(() => { cleanup(); vi.resetAllMocks() })

it('submits the password and preserves the requested destination', async () => {
  login.mockResolvedValue(undefined)
  render(<LoginPage />)
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password' } })
  fireEvent.click(screen.getByRole('button', { name: 'Enter' }))
  await waitFor(() => expect(push).toHaveBeenCalledWith('/groups/g1/sessions'))
  expect(login).toHaveBeenCalledWith('test-password')
  expect(refresh).toHaveBeenCalledOnce()
})

it('disables submission while signing in', async () => {
  let resolve!: () => void
  login.mockReturnValue(new Promise<void>(done => { resolve = done }))
  render(<LoginPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Enter' }))
  expect((screen.getByRole('button', { name: 'Signing in' }) as HTMLButtonElement).disabled).toBe(true)
  resolve()
  await waitFor(() => expect((screen.getByRole('button', { name: 'Enter' }) as HTMLButtonElement).disabled).toBe(false))
})

it('announces a failed login, clears the password, and clears the error on editing', async () => {
  login.mockRejectedValue(new Error('Invalid password'))
  render(<LoginPage />)
  const input = screen.getByLabelText('Password') as HTMLInputElement
  fireEvent.change(input, { target: { value: 'wrong' } })
  fireEvent.submit(input.closest('form')!)
  expect((await screen.findByRole('alert')).textContent).toBe('Invalid password')
  expect(input.value).toBe('')
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(push).not.toHaveBeenCalled()
  fireEvent.change(input, { target: { value: 'retry' } })
  expect(screen.queryByRole('alert')).toBeNull()
})
