import { describe, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ isAuthenticated: vi.fn() }))
vi.mock('./auth', () => auth)
import { parseBuyInCommand, readCommand } from './commands'
import { withAuth, withErrorHandling } from './http'

describe('withErrorHandling', () => {
  it('returns command validation failures with a stable JSON response', async () => {
    const handler = withErrorHandling(async request => {
      await readCommand(request, parseBuyInCommand)
      return Response.json({ ok: true })
    })
    const response = await handler(new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: 'p1', amount: 0 }),
    }), undefined)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ code: 'invalid_input', error: 'amount must be an integer >= 1' })
  })
})

it('logs unexpected failures and returns a safe message with a request ID', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const secret = new Error('private relation/account details')
    const response = await withErrorHandling(async () => { throw secret })(new Request('http://localhost/test?secret=hidden'), undefined)
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body).toMatchObject({ code: 'internal_error', error: 'Something went wrong. Please try again.', request_id: expect.any(String) })
    expect(JSON.stringify(body)).not.toContain('private')
    expect(log).toHaveBeenCalledWith('Request failed', expect.objectContaining({ requestId: body.request_id, path: '/test', error: secret }))
  } finally { log.mockRestore() }
})

it('maps semantic domain errors to HTTP without losing conservation details', async () => {
  const { DomainError } = await import('./domain-error')
  const response = await withErrorHandling(async () => {
    throw new DomainError('unbalanced', 'unbalanced', { diff: -100, total_buyin: 200, total_final: 100 })
  })(new Request('http://localhost/test'), undefined)
  expect(response.status).toBe(422)
  await expect(response.json()).resolves.toMatchObject({ code: 'unbalanced', diff: -100, total_buyin: 200, total_final: 100 })
})


it('uses the same error boundary for authentication failures', async () => {
  const handler = vi.fn(async () => Response.json({ ok: true }))
  auth.isAuthenticated.mockResolvedValueOnce(false)
  const unauthorized = await withAuth(handler)(new Request('http://localhost/test'), undefined)
  expect(unauthorized.status).toBe(401)
  expect(handler).not.toHaveBeenCalled()
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    auth.isAuthenticated.mockRejectedValueOnce(new Error('private auth configuration'))
    const response = await withAuth(handler)(new Request('http://localhost/test'), undefined)
    expect(response.status).toBe(500)
    expect(await response.text()).not.toContain('private auth configuration')
  } finally { log.mockRestore() }
})
