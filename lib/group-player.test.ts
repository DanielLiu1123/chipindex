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

import { createGroupPlayer, deleteGroupPlayer } from './mutations'

type QueryResponse = { data: unknown; error: { message: string } | null }

function mockQueryResponses(responses: Record<string, QueryResponse[]>) {
  dbMocks.from.mockImplementation((table: string) => {
    const response = responses[table]?.shift()
    if (!response) throw new Error(`No mock response configured for ${table}`)
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
      ) => Promise.resolve(response).then(onFulfilled, onRejected),
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
})
