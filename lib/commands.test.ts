import { describe, expect, it } from 'vitest'
import { parseBuyInCommand, parseCreateSessionCommand, readCommand } from './commands'

describe('parseCreateSessionCommand', () => {
  it('rejects an unknown status instead of treating it as an imported session', () => {
    expect(() => parseCreateSessionCommand({
      status: 'ARCHIVED',
      date: '2026-08-14',
      exchange_rate: 40,
      description: null,
      entries: [],
    })).toThrow(expect.objectContaining({ status: 400, message: 'status must be OPEN or SETTLED' }))
  })

  it('returns a discriminated OPEN command after validating nested players', () => {
    expect(parseCreateSessionCommand({
      status: 'OPEN',
      date: '2026-08-14',
      exchange_rate: 40,
      description: null,
      players: [{ player_id: 'p1', initial_buyin: 2000 }],
    })).toEqual({
      status: 'OPEN',
      date: '2026-08-14',
      exchange_rate: 40,
      description: null,
      players: [{ player_id: 'p1', initial_buyin: 2000 }],
    })
  })

  it('rejects invalid calendar dates before a database write', () => {
    expect(() => parseCreateSessionCommand({
      status: 'SETTLED',
      date: '2026-02-30',
      exchange_rate: 40,
      description: null,
      entries: [],
    })).toThrow(expect.objectContaining({ status: 400, message: 'date must be a valid calendar date' }))
  })
})

describe('readCommand', () => {
  it('maps malformed JSON to a stable 400 command error', async () => {
    const request = new Request('http://localhost/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    })
    await expect(readCommand(request, parseBuyInCommand)).rejects.toMatchObject({
      status: 400,
      message: 'Invalid JSON body',
    })
  })
})
