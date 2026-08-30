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

  it('rejects a zero initial buy-in', () => {
    expect(() => parseCreateSessionCommand({
      status: 'OPEN',
      date: '2026-08-14',
      exchange_rate: 40,
      description: null,
      players: [{ player_id: 'p1', initial_buyin: 0 }],
    })).toThrow(expect.objectContaining({
      status: 400,
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

describe('parseCashOutParticipantCommand', () => {
  it('accepts zero final chips as a valid cash out', () => {
    expect(parseCashOutParticipantCommand({ player_id: 'p1', final_chips: 0 })).toEqual({
      player_id: 'p1',
      final_chips: 0,
    })
  })

  it.each([-1, 1.5])('rejects invalid final chips: %s', final_chips => {
    expect(() => parseCashOutParticipantCommand({ player_id: 'p1', final_chips }))
      .toThrow(expect.objectContaining({ status: 400 }))
  })
})

describe('parseUpdateSessionCommand', () => {
  it('preserves effective event timestamps for settled-session edits', () => {
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
    }).participants[0]).toEqual({
      player_id: 'p1',
      final_chips: 3000,
      settled_at: '2026-08-14T13:00:00.000Z',
      buy_ins: [{ amount: 2000, created_at: '2026-08-14T12:00:00.000Z' }],
    })
  })
})
