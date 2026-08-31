import { describe, expect, it } from 'vitest'
import { buildSessionLog } from './session-log'

describe('buildSessionLog', () => {
  it('combines players who join during the first minute into the session start', () => {
    expect(buildSessionLog({
      started_at: '2026-08-31T12:00:00.000Z',
      ended_at: null,
      participants: [
        {
          player_id: 'alice', name: 'Alice', final_chips: null, settled_at: null,
          buy_ins: [{ amount: 2000, created_at: '2026-08-31T12:00:10.000Z' }],
        },
        {
          player_id: 'bob', name: 'Bob', final_chips: null, settled_at: null,
          buy_ins: [{ amount: 2000, created_at: '2026-08-31T12:00:40.000Z' }],
        },
        {
          player_id: 'carol', name: 'Carol', final_chips: null, settled_at: null,
          buy_ins: [{ amount: 4000, created_at: '2026-08-31T12:01:01.000Z' }],
        },
      ],
    }, value => value.slice(11, 16))).toEqual([
      '12:00 Session started with Alice and Bob · buy-in 2,000 each',
      '12:01 Carol joined · buy-in 4,000',
    ])
  })

  it('shows each initial buy-in when starting amounts differ', () => {
    expect(buildSessionLog({
      started_at: '2026-08-31T12:00:00.000Z',
      ended_at: null,
      participants: [
        {
          player_id: 'alice', name: 'Alice', final_chips: null, settled_at: null,
          buy_ins: [{ amount: 2000, created_at: '2026-08-31T12:00:10.000Z' }],
        },
        {
          player_id: 'bob', name: 'Bob', final_chips: null, settled_at: null,
          buy_ins: [{ amount: 4000, created_at: '2026-08-31T12:00:40.000Z' }],
        },
      ],
    }, value => value.slice(11, 16))).toEqual([
      '12:00 Session started with Alice (2,000) and Bob (4,000)',
    ])
  })

  it('keeps the joining buy-in separate from immediately following additions', () => {
    expect(buildSessionLog({
      started_at: '2026-08-31T12:00:00.000Z',
      ended_at: null,
      participants: [{
        player_id: 'alice', name: 'Alice', final_chips: null, settled_at: null,
        buy_ins: [
          { amount: 2000, created_at: '2026-08-31T12:00:10.000Z' },
          { amount: 2000, created_at: '2026-08-31T12:00:20.000Z' },
          { amount: 2000, created_at: '2026-08-31T12:00:30.000Z' },
        ],
      }],
    }, value => value.slice(11, 16))).toEqual([
      '12:00 Session started with Alice · buy-in 2,000',
      '12:00 Alice buy-in · +4,000 (2x)',
    ])
  })

  it('merges later buy-ins in fixed per-player sixty-second windows across other events and midnight', () => {
    expect(buildSessionLog({
      started_at: '2026-08-31T22:00:00.000Z',
      ended_at: null,
      participants: [
        {
          player_id: 'ikun', name: 'iKun', final_chips: null, settled_at: null,
          buy_ins: [
            { amount: 2000, created_at: '2026-08-31T22:01:01.000Z' },
            { amount: 2000, created_at: '2026-08-31T23:59:40.000Z' },
            { amount: 4000, created_at: '2026-09-01T00:00:40.000Z' },
            { amount: 2000, created_at: '2026-09-01T00:00:41.000Z' },
          ],
        },
        {
          player_id: 'yao', name: 'Yao', final_chips: null, settled_at: null,
          buy_ins: [
            { amount: 2000, created_at: '2026-08-31T22:02:00.000Z' },
            { amount: 2000, created_at: '2026-09-01T00:00:00.000Z' },
          ],
        },
      ],
    }, value => value.slice(11, 16))).toEqual([
      '22:00 Session started',
      '22:01 iKun joined · buy-in 2,000',
      '22:02 Yao joined · buy-in 2,000',
      '23:59 iKun buy-in · +6,000 (2x)',
      '00:00 Yao buy-in · +2,000',
      '00:00 iKun buy-in · +2,000',
    ])
  })

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
      '12:00 Session started with Alice · buy-in 2,000',
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
      '12:00 Session started with Alice · buy-in 2,000',
      '12:59 Alice cashed out · 3,000',
      '13:00 Session ended',
    ])
  })
})
