import { beforeEach, describe, expect, it, vi } from 'vitest'
import { parseBatchBuyInCommand } from './commands'
import { createClient } from '@supabase/supabase-js'

const mocks = vi.hoisted(() => ({ from: vi.fn(), insert: vi.fn(), upsert: vi.fn(), update: vi.fn(), not: vi.fn() }))
vi.mock('./db', () => ({ db: { from: mocks.from } }))
import { addBatchBuyin, addBatchParticipants } from './batch-buy-in-mutations'

const command = {
  entries: [
    { id: '10000000-0000-4000-8000-000000000001', player_id: 'p1' },
    { id: '10000000-0000-4000-8000-000000000002', player_id: 'p2' },
  ],
  amount: 2000,
}
const existing = command.entries.map(entry => ({ ...entry, session_id: 's1', amount: 2000, deleted_at: null }))
type Result = { data: unknown; error: { message: string; code?: string } | null }
function setup({ participants = [{ player_id: 'p1', settled_at: null }, { player_id: 'p2', settled_at: null }] as Array<{ player_id: string; settled_at: string | null }>, afterJoin = command.entries.map(entry => ({ player_id: entry.player_id, settled_at: null })) as Array<{ player_id: string; settled_at: string | null }>, buyins = [{ data: [], error: null }, { data: null, error: null }] as Result[], status = 'OPEN', members = ['p1', 'p2'] } = {}) {
  const responses: Record<string, Result[]> = {
    session: [{ data: { status }, error: null }],
    session_participant: [{ data: participants, error: null }, { data: null, error: null }, { data: null, error: null }, { data: afterJoin, error: null }],
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
    chain.update = (...args: unknown[]) => { mocks.update(...args); return chain }
    chain.not = (...args: unknown[]) => { mocks.not(...args); return chain }
    chain.then = (resolve: (result: Result) => unknown) => Promise.resolve(response).then(resolve)
    return chain
  })
}
beforeEach(() => { vi.clearAllMocks() })

describe('participant write query safeguards', () => {
  it('encodes conflict-ignore and a deleted-only restoration filter with the installed SDK', async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = []
    const client = createClient('https://example.supabase.co', 'test-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (input, init) => {
        requests.push({ url: String(input), init })
        return new Response(null, { status: 204 })
      } },
    })
    await client.from('session_participant').upsert(
      [{ session_id: 's1', player_id: 'p1' }],
      { onConflict: 'session_id,player_id', ignoreDuplicates: true },
    )
    await client.from('session_participant').update({ deleted_at: null })
      .eq('session_id', 's1').in('player_id', ['p1']).not('deleted_at', 'is', null)
    expect(new Headers(requests[0].init?.headers).get('Prefer')).toContain('resolution=ignore-duplicates')
    const filter = new URL(requests[1].url).searchParams
    expect(filter.get('session_id')).toBe('eq.s1')
    expect(filter.get('player_id')).toBe('in.(p1)')
    expect(filter.get('deleted_at')).toBe('not.is.null')
  })
})

describe('batch buy-in validation', () => {
  it('accepts a multi-player request with stable record IDs', () => {
    expect(parseBatchBuyInCommand(command)).toEqual(command)
  })
  it('accepts the maximum stored amount and rejects batches above the shared player limit', () => {
    expect(parseBatchBuyInCommand({ ...command, amount: 2147483647 }).amount).toBe(2147483647)
    const entries = Array.from({ length: 101 }, (_, i) => ({
      id: `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`, player_id: `p${i}`,
    }))
    expect(() => parseBatchBuyInCommand({ entries, amount: 2000 })).toThrow('100 participants')
  })
  it('normalizes record UUIDs before checking for duplicates', () => {
    const id = 'abcdef00-0000-4000-8000-000000000001'
    expect(parseBatchBuyInCommand({ ...command, entries: [{ id: id.toUpperCase(), player_id: 'p1' }] }).entries[0].id).toBe(id)
    expect(() => parseBatchBuyInCommand({ ...command, entries: [{ id, player_id: 'p1' }, { id: id.toUpperCase(), player_id: 'p2' }] })).toThrow('Duplicate buy-in id')
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
  it('does not overwrite a concurrent cash-out after reading a missing participant', async () => {
    setup({ participants: [], afterJoin: [
      { player_id: 'p1', settled_at: '2026-09-06T00:00:00Z' },
      { player_id: 'p2', settled_at: null },
    ] })
    await expect(addBatchParticipants('g1', 's1', command)).rejects.toMatchObject({ status: 409 })
    expect(mocks.upsert).toHaveBeenCalledWith(expect.any(Array), {
      onConflict: 'session_id,player_id', ignoreDuplicates: true,
    })
    expect(mocks.not).toHaveBeenCalledWith('deleted_at', 'is', null)
    expect(mocks.insert).not.toHaveBeenCalled()
  })
  it.each([addBatchBuyin, addBatchParticipants])('recovers a completed request after session settlement', async record => {
    setup({ status: 'SETTLED', buyins: [{ data: existing, error: null }] })
    await expect(record('g1', 's1', command)).resolves.toEqual({ count: 2 })
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
  it('retries the original IDs after initial buy-in insert fails, without resetting participants', async () => {
    setup({ participants: [], buyins: [{ data: [], error: null }, { data: null, error: { message: 'write failed' } }] })
    await expect(addBatchParticipants('g1', 's1', command)).rejects.toMatchObject({ status: 500 })
    const originalRows = mocks.insert.mock.calls[0][0]
    mocks.upsert.mockClear()
    mocks.update.mockClear()
    setup()
    await expect(addBatchParticipants('g1', 's1', command)).resolves.toEqual({ count: 2 })
    expect(mocks.insert).toHaveBeenLastCalledWith(originalRows)
    expect(mocks.upsert).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('adds group members and records all initial buy-ins with the requested amount', async () => {
    setup({ participants: [] })
    await expect(addBatchParticipants('g1', 's1', { ...command, amount: 3500 })).resolves.toEqual({ count: 2 })
    expect(mocks.upsert).toHaveBeenCalledExactlyOnceWith([
      { session_id: 's1', player_id: 'p1' },
      { session_id: 's1', player_id: 'p2' },
    ], { onConflict: 'session_id,player_id', ignoreDuplicates: true })
    expect(mocks.not).toHaveBeenCalledExactlyOnceWith('deleted_at', 'is', null)
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
