import { describe, expect, it } from 'vitest'
import { sessionEventLog } from './session-event-log'

const start = '2026-11-26T20:00:00Z'
const join = '2026-11-26T20:05:00Z'
const extra = '2026-11-26T20:30:00Z'
const end = '2026-11-26T21:00:00Z'
const players = ['Maggie', 'iKun', 'Li Sen', 'Yao', 'Peter', 'Ding', 'Freeman']
const participants = players.map((player_id, i) => ({ player_id, created_at: i < 6 ? start : join }))
const source = {
  session: { started_at: start, ended_at: end, status: 'SETTLED' },
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
  it('includes only operations since rollout for an existing session', () => {
    expect(sessionEventLog(source, extra).map(event => event.id)).toEqual(['settled', 'extra'])
    expect(sessionEventLog(source, '2026-11-27T00:00:00Z')).toEqual([])
  })
  it('omits imported sessions and post-settlement additions', () => {
    expect(sessionEventLog({ ...source, session: { ...source.session, started_at: null } }, start)).toEqual([])
    const after = { ...source.buy_ins[0], id: 'edit', created_at: '2026-11-27T00:00:00Z' }
    expect(sessionEventLog({ ...source, buy_ins: [...source.buy_ins, after] })).toEqual(sessionEventLog(source))
  })
})
