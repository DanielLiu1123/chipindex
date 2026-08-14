import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({
  from: vi.fn(),
  chains: [] as Array<{
    table: string
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    is: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }>,
}))

vi.mock('./db', () => ({ db: { from: dbMocks.from } }))

import { createGroupPlayer, createPlayer, deleteGroupPlayer, renamePlayer } from './mutations'

type QueryResponse = { data: unknown; error: { message: string } | null }
type QueryChain = (typeof dbMocks.chains)[number]
type QueryResponder = QueryResponse | ((query: QueryChain) => QueryResponse)

function mockQueryResponses(responses: Record<string, QueryResponder[]>) {
  dbMocks.from.mockImplementation((table: string) => {
    const responder = responses[table]?.shift()
    if (!responder) throw new Error(`No mock response configured for ${table}`)
    const chain = {
      table,
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      maybeSingle: vi.fn(),
      single: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      then: (
        onFulfilled: (value: QueryResponse) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(
        typeof responder === 'function' ? responder(chain) : responder,
      ).then(onFulfilled, onRejected),
    }
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    chain.is.mockReturnValue(chain)
    chain.maybeSingle.mockReturnValue(chain)
    chain.single.mockReturnValue(chain)
    chain.insert.mockReturnValue(chain)
    chain.update.mockReturnValue(chain)
    dbMocks.chains.push(chain)
    return chain
  })
}

beforeEach(() => {
  dbMocks.from.mockReset()
  dbMocks.chains.length = 0
})

describe('group_player lifecycle', () => {
  it('creates a player and membership without redundantly re-reading the new player', async () => {
    mockQueryResponses({
      group: [{ data: { id: 'g1' }, error: null }],
      player: [{ data: { id: 'p1', name: 'Alice' }, error: null }],
      group_player: [{ data: { id: 'gp1', group_id: 'g1', player_id: 'p1' }, error: null }],
    })

    await expect(createPlayer('Alice', 'g1')).resolves.toMatchObject({
      player: { id: 'p1' },
      group_player: { id: 'gp1' },
    })
    expect(dbMocks.chains.filter(query => query.table === 'player')).toHaveLength(1)
  })

  it('soft deletes a newly created player when membership creation fails', async () => {
    mockQueryResponses({
      group: [{ data: { id: 'g1' }, error: null }],
      player: [
        { data: { id: 'p1', name: 'Alice' }, error: null },
        { data: null, error: null },
      ],
      group_player: [{ data: null, error: { message: 'membership insert failed' } }],
    })

    await expect(createPlayer('Alice', 'g1')).rejects.toMatchObject({
      status: 500,
      message: 'membership insert failed',
    })
    const cleanup = dbMocks.chains.filter(query => query.table === 'player')[1]
    const payload = cleanup.update.mock.calls[0][0]
    expect(payload.deleted_at).toBe(payload.updated_at)
    expect(cleanup.eq).toHaveBeenCalledWith('id', 'p1')
  })

  it('creates a new group_player row', async () => {
    mockQueryResponses({
      group: [{ data: { id: 'g1' }, error: null }],
      player: [{ data: { id: 'p1' }, error: null }],
      group_player: [{ data: { id: 'gp1' }, error: null }],
    })

    await createGroupPlayer('g1', 'p1')

    const groupPlayer = dbMocks.chains.find(query => query.table === 'group_player')!
    const payload = groupPlayer.insert.mock.calls[0][0]
    expect(payload).toEqual({ group_id: 'g1', player_id: 'p1' })
    expect(payload).not.toHaveProperty('active')
    expect(payload).not.toHaveProperty('deactivated_at')
  })

  it('deletes group_player by setting deleted_at', async () => {
    mockQueryResponses({
      group_player: [{ data: { id: 'gp1' }, error: null }],
    })

    await deleteGroupPlayer('g1', 'p1')

    const query = dbMocks.chains.find(item => item.table === 'group_player')!
    const payload = query.update.mock.calls[0][0]
    expect(payload.deleted_at).toBe(payload.updated_at)
    expect(typeof payload.deleted_at).toBe('string')
    expect(query.is).toHaveBeenCalledWith('deleted_at', null)
  })

  it('rejects an orphan group_player now that the database has no foreign keys', async () => {
    mockQueryResponses({
      group: [{ data: { id: 'g1' }, error: null }],
      player: [{ data: null, error: null }],
    })

    await expect(createGroupPlayer('g1', 'missing')).rejects.toMatchObject({
      status: 404,
      message: 'Player not found',
    })
    expect(dbMocks.chains.some(query => query.table === 'group_player')).toBe(false)
  })

  it('renames a player after they leave and rejoin the group', async () => {
    mockQueryResponses({
      group_player: [query => ({
        data: query.is.mock.calls.some(call => call[0] === 'deleted_at' && call[1] === null)
          ? { id: 'gp-current' }
          : null,
        error: null,
      })],
      player: [{ data: { id: 'p1', name: 'Alice', created_at: '2026-08-14T00:00:00Z' }, error: null }],
    })

    await expect(renamePlayer('g1', 'p1', 'Alice')).resolves.toMatchObject({
      id: 'p1',
      name: 'Alice',
    })
  })
})
