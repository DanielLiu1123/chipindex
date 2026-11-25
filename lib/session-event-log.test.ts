import { describe, expect, it } from 'vitest'
import { sessionEventLog } from './session-event-log'

const start = '2026-11-26T20:00:00Z'
const join = '2026-11-26T20:05:00Z'
const extra = '2026-11-26T20:30:00Z'
const end = '2026-11-26T21:00:00Z'
const players = ['Maggie', 'iKun', 'Li Sen', 'Yao', 'Peter', 'Ding', 'Freeman']
const participants = players.map((player_id, i) => ({ player_id, created_at: i < 6 ? start : join }))
const source = {
  session: { created_at: start, started_at: start, ended_at: end, status: 'SETTLED' as const },
  participants,
  names: new Map(players.map(name => [name, name])),
  buy_ins: [
    ...participants.map((p, i) => ({ ...p, id: String(i), amount: i === 5 ? 4000 : 2000 })),
    { id: 'extra', player_id: 'Maggie', created_at: extra, amount: 2000 },
  ],
}

describe('session event log', () => {
  it('groups six opening players by amount and shows a later join only once', () => {
    const entries = sessionEventLog(source)
    expect(entries.map(event => event.text)).toEqual([
      'Session settled.',
      'Maggie bought in for 2,000 chips.',
      'Freeman joined with 2,000 chips.',
      'Session started. Li Sen, Maggie, Peter, Yao, and iKun bought in for 2,000 chips each. Ding bought in for 4,000 chips.',
    ])
  })
  it('shows historical live events when old inserts used separate timestamps', () => {
    const oldStart = '2026-11-26T19:59:59Z'
    const events = sessionEventLog({ ...source, session: { ...source.session, started_at: oldStart } })
    expect(events.at(-1)).toEqual({ id: 'start', time: oldStart, text: 'Session started.' })
    expect(events).toContainEqual({ id: 'join-Maggie', time: start, text: 'Maggie joined with 2,000 chips.' })
    expect(events[0].id).toBe('settled')
  })
  it('folds legacy opening and later join writes, keeping subsequent buys separate', () => {
    const roster = '2026-11-25T11:22:51.089606Z'
    const later = '2026-11-25T11:24:51.185253Z'
    const names = ['Ding', 'Frank', 'Yuan Liang', 'Freeman', 'Wang Yue', 'Sanjor Yang', 'Yao']
    const opening = names.map(player_id => ({ player_id, created_at: roster }))
    const events = sessionEventLog({
      ...source,
      session: { ...source.session, started_at: '2026-11-25T11:22:50.916Z' },
      participants: [...opening, { player_id: 'iKun', created_at: later }],
      buy_ins: [
        ...opening.map(p => ({ ...p, id: p.player_id, amount: 2000, created_at: '2026-11-25T11:22:51.100573Z' })),
        { player_id: 'iKun', id: 'first', amount: 2000, created_at: '2026-11-25T11:24:51.621693Z' },
        { player_id: 'iKun', id: 'again', amount: 2000, created_at: '2026-11-25T11:24:51.800Z' },
      ],
    })
    expect(events.map(e => e.text)).toEqual([
      'Session settled.', 'iKun bought in for 2,000 chips.', 'iKun joined with 2,000 chips.',
      'Session started. Ding, Frank, Freeman, Sanjor Yang, Wang Yue, Yao, and Yuan Liang bought in for 2,000 chips each.',
    ])
  })
  it('shows the import time without interpreting synthetic buy-ins as live events', () => {
    expect(sessionEventLog({ ...source, session: { ...source.session, started_at: null, ended_at: null } }))
      .toEqual([{ id: 'import', time: start, text: 'Session imported.' }])
  })
  it('omits post-settlement additions', () => {
    const after = { ...source.buy_ins[0], id: 'edit', created_at: '2026-11-27T00:00:00Z' }
    expect(sessionEventLog({ ...source, buy_ins: [...source.buy_ins, after] })).toEqual(sessionEventLog(source))
  })
})
