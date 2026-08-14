import { describe, expect, it } from 'vitest'
import { parseBuyInCommand, readCommand } from './commands'
import { withErrorHandling } from './http'

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
    await expect(response.json()).resolves.toEqual({ error: 'amount must be an integer >= 1' })
  })
})
