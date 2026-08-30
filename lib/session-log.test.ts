import { describe, expect, it } from 'vitest'
import { buildSessionLog } from './session-log'

describe('buildSessionLog', () => {
  it('does not report final settlements with sub-second timestamp drift as early cash-outs', () => {
    expect(buildSessionLog({
      started_at: '2026-08-31T12:00:00.000Z',
      ended_at: '2026-08-31T13:00:00.000Z',
      participants: [{
        player_id: 'alice', name: 'Alice', final_chips: 3000,
        settled_at: '2026-08-31T13:00:00.450Z',
        buy_ins: [{ amount: 2000, created_at: '2026-08-31T12:01:00.000Z' }],
      }],
    }, value => value.slice(11, 16))).toEqual([
      '12:00 Session started',
      '12:01 Alice joined · buy-in 2,000',
      '13:00 Session ended',
    ])
  })

  it('keeps a real cash-out even when it happens just before the session ends', () => {
    expect(buildSessionLog({
      started_at: '2026-08-31T12:00:00.000Z',
      ended_at: '2026-08-31T13:00:00.000Z',
      participants: [{
        player_id: 'alice', name: 'Alice', final_chips: 3000,
        settled_at: '2026-08-31T12:59:59.000Z',
        buy_ins: [{ amount: 2000, created_at: '2026-08-31T12:01:00.000Z' }],
      }],
    }, value => value.slice(11, 16))).toEqual([
      '12:00 Session started',
      '12:01 Alice joined · buy-in 2,000',
      '12:59 Alice cashed out · 3,000',
      '13:00 Session ended',
    ])
  })
})
