import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditedParticipant } from './contracts'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('./db', () => ({ db: { from: mocks.from } }))
import { updateSettledSession } from './session-mutations'

type Row = Record<string, unknown>
let tables: Record<string, Row[]>
let writes: Array<{ table: string; op: string; values: Row }>
let failInsert: boolean
// Stateful database adapter: assertions inspect persisted identity and data,
// not the exact number/order of SDK calls.
beforeEach(() => {
  writes = []; failInsert = false
  tables = {
    session: [{ id: 's1', group_id: 'g1', status: 'SETTLED', ended_at: '2026-08-14T13:00:00Z', deleted_at: null }],
    session_participant: [
      { id: 'part1', session_id: 's1', player_id: 'p1', final_chips: 100, settled_at: '2026-08-14T12:30:00Z', deleted_at: null },
      { id: 'part2', session_id: 's1', player_id: 'p2', final_chips: 200, settled_at: '2026-08-14T13:00:00Z', deleted_at: null },
    ],
    buy_in: [
      { id: 'b1', session_id: 's1', player_id: 'p1', amount: 100, created_at: '2026-08-14T11:00:00.123Z', deleted_at: null },
      { id: 'b2', session_id: 's1', player_id: 'p2', amount: 200, created_at: '2026-08-14T12:00:00Z', deleted_at: null },
      { id: 'revoked', session_id: 's1', player_id: 'p1', amount: 500, deleted_at: '2026-08-14T12:00:00Z' },
      { id: 'foreign', session_id: 's2', player_id: 'p1', amount: 100, deleted_at: null },
    ],
    group_player: [{ player_id: 'p3', group_id: 'g1', deleted_at: null }],
  }
  mocks.from.mockImplementation((table: string) => {
    let op = 'select', values: Row = {}, single = false
    const predicates: Array<(row: Row) => boolean> = []
    const chain = {
      select: () => chain,
      eq: (key: string, value: unknown) => { predicates.push(row => row[key] === value); return chain },
      is: (key: string, value: unknown) => { predicates.push(row => row[key] === value); return chain },
      in: (key: string, values: unknown[]) => { predicates.push(row => values.includes(row[key])); return chain },
      maybeSingle: () => { single = true; return chain },
      update: (row: Row) => { op = 'update'; values = row; return chain },
      insert: (row: Row) => { op = 'insert'; values = row; return chain },
      delete: () => { throw new Error('Hard delete is forbidden') },
      then: (resolve: (value: unknown) => unknown) => {
        if (op === 'insert' && failInsert) return Promise.resolve({ error: { message: 'injected failure' } }).then(resolve)
        let rows = tables[table].filter(row => predicates.every(test => test(row)))
        if (op === 'update') { writes.push({ table, op, values }); rows.forEach(row => Object.assign(row, values)) }
        if (op === 'insert') { writes.push({ table, op, values }); const row = { id: `new-${writes.length}`, ...values }; tables[table].push(row); rows = [row] }
        return Promise.resolve({ data: single ? rows[0] ?? null : rows.map(row => ({ ...row })), error: null }).then(resolve)
      },
    }
    return chain
  })
})
const meta = { date: '2026-08-14', exchange_rate: 40, description: null }
const existing = (): EditedParticipant[] => [
  { player_id: 'p1', final_chips: 100, buy_ins: [{ id: 'b1', amount: 100 }] },
  { player_id: 'p2', final_chips: 200, buy_ins: [{ id: 'b2', amount: 200 }] },
]

describe('in-place settled-session edits', () => {
  it('preserves IDs, event timestamps and revoked history on unchanged save', async () => {
    const before = structuredClone(tables)
    await updateSettledSession('g1', 's1', meta, existing(), false)
    expect(tables.buy_in).toEqual(before.buy_in)
    expect(tables.session_participant).toEqual(before.session_participant)
    expect(writes.every(write => write.table === 'session')).toBe(true)
  })
  it('updates existing events in place and inserts only new records', async () => {
    const edits = existing(); edits[0].buy_ins[0].amount = 150; edits[0].final_chips = 150
    edits.push({ player_id: 'p3', final_chips: 300, buy_ins: [{ amount: 300 }] })
    await updateSettledSession('g1', 's1', meta, edits, false)
    expect(tables.buy_in.find(row => row.id === 'b1')).toMatchObject({ amount: 150, created_at: '2026-08-14T11:00:00.123Z' })
    expect(tables.session_participant.find(row => row.id === 'part1')).toMatchObject({ final_chips: 150, settled_at: '2026-08-14T12:30:00Z' })
    expect(tables.session_participant.find(row => row.player_id === 'p3')).toMatchObject({ settled_at: '2026-08-14T13:00:00Z' })
    expect(writes.filter(write => write.op === 'insert')).toHaveLength(2)
  })
  it('soft deletes only explicitly omitted active events and participants', async () => {
    await updateSettledSession('g1', 's1', meta, [existing()[0]], false)
    expect(tables.buy_in.find(row => row.id === 'b2')!.deleted_at).not.toBeNull()
    expect(tables.session_participant.find(row => row.id === 'part2')!.deleted_at).not.toBeNull()
    expect(tables.buy_in.find(row => row.id === 'revoked')!.deleted_at).toBe('2026-08-14T12:00:00Z')
    expect(tables.buy_in.find(row => row.id === 'foreign')!.deleted_at).toBeNull()
  })
  it.each(['foreign', 'revoked', 'b2', 'missing'])('rejects an invalid event identity %s before any write', async id => {
    const edits = existing(); edits[0].buy_ins[0].id = id
    await expect(updateSettledSession('g1', 's1', meta, edits, false)).rejects.toMatchObject({ code: 'conflict' })
    expect(writes).toEqual([])
  })
  it('rejects repeated buy-in IDs before any write', async () => {
    const edits = existing(); edits[0].buy_ins.push({ id: 'b1', amount: 100 })
    await expect(updateSettledSession('g1', 's1', meta, edits, true)).rejects.toMatchObject({ code: 'invalid_input' })
    expect(writes).toEqual([])
  })
  it('does not remove old events when a new insert fails', async () => {
    failInsert = true
    const edits = [existing()[0], { player_id: 'p3', final_chips: 300, buy_ins: [{ amount: 300 }] }]
    const before = structuredClone(tables)
    await expect(updateSettledSession('g1', 's1', meta, edits, false)).rejects.toThrow('Database operation failed')
    expect(tables).toEqual(before)
  })
})
