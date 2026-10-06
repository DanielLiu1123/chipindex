import { describe, expect, it } from 'vitest'
import { parseBuyInCommand, parseCashOutParticipantCommand, parseCreateSessionCommand, parseUpdateSessionCommand, readCommand } from './commands'

describe('parseCreateSessionCommand', () => {
  it('rejects an unknown status instead of treating it as an imported session', () => {
    expect(() => parseCreateSessionCommand({
      status: 'ARCHIVED',
      date: '2026-08-14',
      exchange_rate: 40,
      description: null,
      entries: [],
    })).toThrow(expect.objectContaining({ code: 'invalid_input', message: 'status must be OPEN or SETTLED' }))
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

  it('rejects a zero initial buy-in', () => {
    expect(() => parseCreateSessionCommand({
      status: 'OPEN',
      date: '2026-08-14',
      exchange_rate: 40,
      description: null,
      players: [{ player_id: 'p1', initial_buyin: 0 }],
    })).toThrow(expect.objectContaining({
      code: 'invalid_input',
      message: 'players[0].initial_buyin must be an integer >= 1',
    }))
  })

  it('rejects invalid calendar dates before a database write', () => {
    expect(() => parseCreateSessionCommand({
      status: 'SETTLED',
      date: '2026-02-30',
      exchange_rate: 40,
      description: null,
      entries: [],
    })).toThrow(expect.objectContaining({ code: 'invalid_input', message: 'date must be a valid calendar date' }))
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
      code: 'invalid_input',
      message: 'Invalid JSON body',
    })
  })
})

describe('parseCashOutParticipantCommand', () => {
  it('accepts zero final chips as a valid cash out', () => {
    expect(parseCashOutParticipantCommand({ player_id: 'p1', final_chips: 0 })).toEqual({
      player_id: 'p1',
      final_chips: 0,
    })
  })

  it.each([-1, 1.5])('rejects invalid final chips: %s', final_chips => {
    expect(() => parseCashOutParticipantCommand({ player_id: 'p1', final_chips }))
      .toThrow(expect.objectContaining({ code: 'invalid_input' }))
  })
})

describe('parseUpdateSessionCommand', () => {
  it('accepts editable buy-in timestamps without trusting a client settlement timestamp', () => {
    expect(parseUpdateSessionCommand({
      date: '2026-08-14',
      exchange_rate: 40,
      description: null,
      force: false,
      participants: [{
        player_id: 'p1',
        final_chips: 3000,
        settled_at: '2026-08-14T13:00:00.000Z',
        buy_ins: [{ amount: 2000, created_at: '2026-08-14T12:00:00.000Z' }],
      }],
    }).participants![0]).toEqual({
      player_id: 'p1',
      final_chips: 3000,
      buy_ins: [{ amount: 2000, created_at: '2026-08-14T12:00:00.000Z' }],
    })
  })
})

it('retains buy-in identity when parsing a settled-session edit', () => {
  const command = parseUpdateSessionCommand({ date: '2026-09-08', exchange_rate: 40, description: null,
    participants: [{ player_id: 'p1', final_chips: 100, buy_ins: [{ id: 'existing-event', amount: 100 }] }], force: false })
  expect(command.participants![0].buy_ins).toEqual([{ id: 'existing-event', amount: 100 }])
})

it('accepts rate-only edits without defaulting omitted metadata or participants', () => {
  expect(parseUpdateSessionCommand({ exchange_rate: 20.5 })).toEqual({ exchange_rate: 20.5, force: false })
})

it.each([undefined, null, '', '40', 0, -1, NaN, Infinity, true])('rejects invalid rate-only edits: %s', rate => {
  expect(() => parseUpdateSessionCommand({ exchange_rate: rate })).toThrow()
})

it('rejects empty edits and malformed participant payloads', () => {
  for (const body of [{}, { force: true }, { exchange_rate: 20, participants: null }]) {
    expect(() => parseUpdateSessionCommand(body)).toThrow()
  }
})
