import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseBatchBuyInCommand } from './commands'

const mocks = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn(), upsert: vi.fn() }))
vi.mock('./db', () => ({ db: { from: mocks.from } }))
import { addBatchBuyin, addBatchParticipants } from './live-session-mutations'

const command = {
  entries: [
    { id: '10000000-0000-4000-8000-000000000001', player_id: 'p1' },
    { id: '10000000-0000-4000-8000-000000000002', player_id: 'p2' },
  ],
  amount: 2000,
}
const existing = command.entries.map(entry => ({ ...entry, session_id: 's1', amount: 2000, deleted_at: null }))
type Result = { data: unknown; error: { message: string; code?: string } | null }
function setup({ participants = [{ player_id: 'p1', settled_at: null }, { player_id: 'p2', settled_at: null }] as Array<{ player_id: string; settled_at: string | null }>, buyins = [{ data: [], error: null }, { data: null, error: null }] as Result[], status = 'OPEN', members = ['p1', 'p2'] } = {}) {
  const responses: Record<string, Result[]> = {
    session: [{ data: { status }, error: null }],
    session_participant: [{ data: participants, error: null }, { data: null, error: null }],
    group_player: [{ data: members.map(player_id => ({ player_id })), error: null }],
    buy_in: [...buyins],
  }
  mocks.from.mockImplementation((table: string) => {
    const response = responses[table]?.shift()
    if (!response) throw Error(`Unexpected query: ${table}`)
    const chain: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'is', 'in', 'maybeSingle']) chain[method] = vi.fn(() => chain)
    chain.insert = (...args: unknown[]) => { mocks.insert(...args); return chain }
    chain.upsert = (...args: unknown[]) => { mocks.upsert(...args); return chain }
    chain.then = (resolve: (result: Result) => unknown) => Promise.resolve(response).then(resolve)
    return chain
  })
}
beforeEach(() => { vi.clearAllMocks() })

describe('batch buy-in validation', () => {
  it('accepts a multi-player request with stable record IDs', () => {
    expect(parseBatchBuyInCommand(command)).toEqual(command)
  })
  it.each([
    { ...command, entries: [] },
    { ...command, entries: [command.entries[0], command.entries[0]] },
    { ...command, entries: [command.entries[0], { ...command.entries[1], player_id: 'p1' }] },
    { ...command, entries: [{ id: 'invalid', player_id: 'p1' }] },
    { ...command, amount: 0 }, { ...command, amount: 1.5 }, { ...command, amount: '2000' },
    { ...command, amount: 2147483648 },
  ])('rejects invalid batches before writing', value => {
    expect(() => parseBatchBuyInCommand(value)).toThrow()
  })
})

describe('batch buy-in persistence', () => {
  it('adds group members and records all initial buy-ins with the requested amount', async () => {
    setup({ participants: [] })
    await expect(addBatchParticipants('g1', 's1', { ...command, amount: 3500 })).resolves.toEqual({ count: 2 })
    expect(mocks.upsert).toHaveBeenCalledExactlyOnceWith([
      expect.objectContaining({ session_id: 's1', player_id: 'p1', deleted_at: null }),
      expect.objectContaining({ session_id: 's1', player_id: 'p2', deleted_at: null }),
    ], { onConflict: 'session_id,player_id' })
    expect(mocks.insert).toHaveBeenCalledWith(command.entries.map(entry => ({ ...entry, session_id: 's1', amount: 3500 })))
  })
  it('rejects group outsiders before adding any participants', async () => {
    setup({ participants: [], members: ['p1'] })
    await expect(addBatchParticipants('g1', 's1', command)).rejects.toMatchObject({ status: 422 })
    expect(mocks.upsert).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled()
  })
  it('does not repeat a completed join after a lost response', async () => {
    setup({ buyins: [{ data: existing, error: null }] })
    await expect(addBatchParticipants('g1', 's1', command)).resolves.toEqual({ count: 2 })
    expect(mocks.upsert).not.toHaveBeenCalled(); expect(mocks.insert).not.toHaveBeenCalled()
  })
  it('can retry initial buy-ins after participants were created without resetting them', async () => {
    setup()
    await expect(addBatchParticipants('g1', 's1', command)).resolves.toEqual({ count: 2 })
    expect(mocks.upsert).not.toHaveBeenCalled(); expect(mocks.insert).toHaveBeenCalledOnce()
  })
  it('records all selected participants in one atomic insert without adding participants', async () => {
    setup()
    await expect(addBatchBuyin('g1', 's1', command)).resolves.toEqual({ count: 2 })
    expect(mocks.insert).toHaveBeenCalledExactlyOnceWith(command.entries.map(entry => ({ ...entry, session_id: 's1', amount: 2000 })))
    expect(mocks.from.mock.calls.map(args => args[0])).not.toContain('group_player')
  })
  it('rejects a session outsider before inserting any of the batch', async () => {
    setup({ participants: [{ player_id: 'p1', settled_at: null }] })
    await expect(addBatchBuyin('g1', 's1', command)).rejects.toMatchObject({ status: 422 })
    expect(mocks.insert).not.toHaveBeenCalled()
  })
  it('rejects a cashed-out participant before inserting any of the batch', async () => {
    setup({ participants: [{ player_id: 'p1', settled_at: null }, { player_id: 'p2', settled_at: '2026-09-06T00:00:00Z' }] })
    await expect(addBatchBuyin('g1', 's1', command)).rejects.toMatchObject({ status: 409 })
    expect(mocks.insert).not.toHaveBeenCalled()
  })
  it('rejects a closed session', async () => {
    setup({ status: 'SETTLED' })
    await expect(addBatchBuyin('g1', 's1', command)).rejects.toMatchObject({ status: 409 })
    expect(mocks.insert).not.toHaveBeenCalled()
  })
  it('recovers a lost response without inserting again', async () => {
    setup({ buyins: [{ data: existing, error: null }] })
    await expect(addBatchBuyin('g1', 's1', command)).resolves.toEqual({ count: 2 })
    expect(mocks.insert).not.toHaveBeenCalled()
  })
  it('recovers a simultaneous retry that collided on primary keys', async () => {
    setup({ buyins: [{ data: [], error: null }, { data: null, error: { code: '23505', message: 'duplicate' } }, { data: existing, error: null }] })
    await expect(addBatchBuyin('g1', 's1', command)).resolves.toEqual({ count: 2 })
  })
  it.each([
    existing.slice(0, 1),
    existing.map(row => ({ ...row, amount: 4000 })),
    existing.map(row => ({ ...row, deleted_at: '2026-09-06T00:00:00Z' })),
    existing.map(row => ({ ...row, session_id: 'other-session' })),
  ])('does not overwrite or resurrect conflicting records', async (...rows) => {
    setup({ buyins: [{ data: rows, error: null }] })
    await expect(addBatchBuyin('g1', 's1', command)).rejects.toMatchObject({ status: 409 })
    expect(mocks.insert).not.toHaveBeenCalled()
  })
  it('surfaces insert failures rather than reporting a successful batch', async () => {
    setup({ buyins: [{ data: [], error: null }, { data: null, error: { message: 'write failed' } }] })
    await expect(addBatchBuyin('g1', 's1', command)).rejects.toMatchObject({ status: 500 })
  })
})
