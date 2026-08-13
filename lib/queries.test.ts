import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({
  from: vi.fn(),
  chains: [] as Array<{
    table: string
    select: ReturnType<typeof vi.fn>
    is: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    range: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
  }>,
}))

vi.mock('./db', () => ({
  db: { from: dbMocks.from },
}))

import { getLeaderboardPlayers, getLeaderboardSessions, getPlayerDetail, getSessionDetail } from './queries'

type QueryResponse = { data: unknown }

function mockQueryResponses(responses: Record<string, QueryResponse[]>) {
  dbMocks.from.mockImplementation((table: string) => {
    const response = responses[table]?.shift()
    if (!response) throw new Error(`No mock response configured for ${table}`)

    const chain = {
      table,
      select: vi.fn(),
      is: vi.fn(),
      eq: vi.fn(),
      in: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      then: (
        onFulfilled: (value: QueryResponse) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(response).then(onFulfilled, onRejected),
    }
    chain.select.mockReturnValue(chain)
    chain.is.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    chain.in.mockReturnValue(chain)
    chain.order.mockReturnValue(chain)
    chain.range.mockReturnValue(chain)
    chain.single.mockReturnValue(chain)
    chain.maybeSingle.mockReturnValue(chain)
    dbMocks.chains.push(chain)
    return chain
  })
}

beforeEach(() => {
  dbMocks.from.mockReset()
  dbMocks.chains.length = 0
})

describe('getLeaderboardSessions', () => {
  it('returns settlement details from non-deleted participant and buy-in rows', async () => {
    mockQueryResponses({
      session: [{ data: [{ id: 's1', date: '2026-01-10', exchange_rate: 40 }] }],
      session_participant: [{
        data: [{ session_id: 's1', player_id: 'alice', final_chips: 5000 }],
      }],
      buy_in: [{
        data: [
          { session_id: 's1', player_id: 'alice', amount: 2000 },
          { session_id: 's1', player_id: 'alice', amount: 500 },
        ],
      }],
    })

    const sessions = await getLeaderboardSessions('g1')

    const sessionQuery = dbMocks.chains.find(query => query.table === 'session')!
    expect(sessionQuery.eq).toHaveBeenCalledWith('group_id', 'g1')

    const participantQuery = dbMocks.chains.find(query => query.table === 'session_participant')!
    expect(participantQuery.select).toHaveBeenCalledWith('session_id, player_id, final_chips')
    expect(participantQuery.is).toHaveBeenCalledWith('deleted_at', null)

    const buyInQuery = dbMocks.chains.find(query => query.table === 'buy_in')!
    expect(buyInQuery.select).toHaveBeenCalledWith('session_id, player_id, amount')
    expect(buyInQuery.is).toHaveBeenCalledWith('deleted_at', null)

    expect(sessions).toEqual([
      {
        id: 's1',
        date: '2026-01-10',
        exchange_rate: 40,
        session_entries: [{
          player_id: 'alice',
          chips: 2500,
          final_chips: 5000,
          total_buyin: 2500,
          buy_in_count: 2,
        }],
      },
    ])
  })
})

describe('getLeaderboardPlayers', () => {
  it('keeps historical players after their group_player row is deleted', async () => {
    mockQueryResponses({
      group_player: [{ data: [
        { id: 'gp-active', group_id: 'g1', player_id: 'active', created_at: '2026-01-01', updated_at: '2026-01-01', deleted_at: null },
        { id: 'gp-first', group_id: 'g1', player_id: 'first', created_at: '2026-01-02', updated_at: '2026-01-02', deleted_at: null },
      ] }],
      player: [
        { data: [
          { id: 'active', name: 'Active', created_at: '2026-01-03' },
          { id: 'first', name: 'First', created_at: '2026-01-01' },
        ] },
        { data: [{ id: 'historic', name: 'Historic', created_at: '2025-12-01' }] },
      ],
      session: [{ data: [{ id: 's1' }] }],
      session_participant: [{ data: [{ player_id: 'historic' }] }],
    })

    const players = await getLeaderboardPlayers('g1')

    expect(dbMocks.chains.find(query => query.table === 'group_player')?.select)
      .toHaveBeenCalledWith('id, group_id, player_id, created_at, updated_at, deleted_at')
    expect(dbMocks.chains.find(query => query.table === 'group_player')?.is)
      .toHaveBeenCalledWith('deleted_at', null)
    expect(dbMocks.chains.filter(query => query.table === 'player')[0]?.in)
      .toHaveBeenCalledWith('id', ['active', 'first'])
    expect(dbMocks.chains.filter(query => query.table === 'player')[1]?.in)
      .toHaveBeenCalledWith('id', ['historic'])
    expect(players.map(player => player.id)).toEqual(['historic', 'first', 'active'])
  })
})

describe('getSessionDetail', () => {
  it('preserves each buy-in timestamp for the settled session UI', async () => {
    mockQueryResponses({
      session: [{ data: { id: 's1', date: '2026-08-08', description: null, exchange_rate: 40, status: 'SETTLED' } }],
      session_participant: [{ data: [{ id: 'part-1', player_id: 'alice', final_chips: 6000 }] }],
      buy_in: [{ data: [
        { player_id: 'alice', amount: 2000, created_at: '2026-08-08T06:59:27Z' },
        { player_id: 'alice', amount: 2000, created_at: '2026-08-08T09:56:18Z' },
      ] }],
      player: [{ data: [{ id: 'alice', name: 'Alice' }] }],
    })

    const detail = await getSessionDetail('g1', 's1')

    const sessionQuery = dbMocks.chains.find(query => query.table === 'session')!
    expect(sessionQuery.eq).toHaveBeenCalledWith('group_id', 'g1')

    expect(detail?.session_entries[0].buy_ins).toEqual([
      { amount: 2000, created_at: '2026-08-08T06:59:27Z' },
      { amount: 2000, created_at: '2026-08-08T09:56:18Z' },
    ])
  })
})

describe('getPlayerDetail', () => {
  it('returns player settlement details and the session start timestamp', async () => {
    mockQueryResponses({
      player: [{ data: { id: 'alice', name: 'Alice' } }],
      group_player: [{ data: {
        id: 'gp-alice',
        group_id: 'g1',
        player_id: 'alice',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        deleted_at: null,
      } }],
      session_participant: [
        { data: [{ session_id: 's1' }] },
        { data: [{ session_id: 's1', player_id: 'alice', final_chips: 5000 }] },
      ],
      session: [
        { data: [{ id: 's1' }] },
        { data: [{
          id: 's1',
          date: '2026-01-10',
          description: 'first game',
          exchange_rate: 40,
          started_at: '2026-01-10T12:00:00Z',
        }] },
      ],
      buy_in: [{
        data: [
          { session_id: 's1', player_id: 'alice', amount: 2000 },
          { session_id: 's1', player_id: 'alice', amount: 500 },
        ],
      }],
    })

    const detail = await getPlayerDetail('g1', 'alice')

    const sessionQuery = dbMocks.chains.filter(query => query.table === 'session')[1]!
    expect(sessionQuery.select).toHaveBeenCalledWith('id, date, description, exchange_rate, started_at')
    expect(detail).toEqual({
      id: 'alice',
      name: 'Alice',
      group_player: {
        id: 'gp-alice',
        group_id: 'g1',
        player_id: 'alice',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        deleted_at: null,
      },
      entries: [{
        session_id: 's1',
        chips: 2500,
        final_chips: 5000,
        total_buyin: 2500,
        buy_in_count: 2,
        sessions: {
          id: 's1',
          date: '2026-01-10',
          description: 'first game',
          exchange_rate: 40,
          started_at: '2026-01-10T12:00:00Z',
          session_entries: [{
            player_id: 'alice',
            chips: 2500,
            final_chips: 5000,
            total_buyin: 2500,
            buy_in_count: 2,
          }],
        },
      }],
    })
  })

  it('includes buy-ins beyond the first Data API result page', async () => {
    const firstPage = Array.from({ length: 1000 }, () => ({
      session_id: 's1',
      player_id: 'alice',
      amount: 1,
    }))

    mockQueryResponses({
      player: [{ data: { id: 'alice', name: 'Alice' } }],
      group_player: [{ data: { deleted_at: null } }],
      session_participant: [
        { data: [{ session_id: 's1' }] },
        { data: [{ session_id: 's1', player_id: 'alice', final_chips: 1001 }] },
      ],
      session: [
        { data: [{ id: 's1' }] },
        { data: [{
          id: 's1',
          date: '2026-01-10',
          description: null,
          exchange_rate: 40,
          started_at: '2026-01-10T12:00:00Z',
        }] },
      ],
      buy_in: [
        { data: firstPage },
        { data: [{ session_id: 's1', player_id: 'alice', amount: 1 }] },
      ],
    })

    const detail = await getPlayerDetail('g1', 'alice')

    expect(detail?.entries[0]).toMatchObject({
      chips: 0,
      total_buyin: 1001,
      buy_in_count: 1001,
    })
  })
})
