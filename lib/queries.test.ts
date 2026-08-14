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

import {
  getLeaderboardData,
  getPlayerDetail,
  getSessionPageData,
  getSessionsPage,
} from './queries'

type QueryResponse = { data: unknown; error?: unknown; count?: number | null }
type QueryChain = (typeof dbMocks.chains)[number]
type QueryResponder = QueryResponse | ((query: QueryChain) => QueryResponse)

function mockQueryResponses(responses: Record<string, QueryResponder[]>) {
  dbMocks.from.mockImplementation((table: string) => {
    const responder = responses[table]?.shift()
    if (!responder) throw new Error(`No mock response configured for ${table}`)

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
      ) => Promise.resolve(
        typeof responder === 'function' ? responder(chain) : responder,
      ).then(onFulfilled, onRejected),
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

describe('query failures', () => {
  it('does not disguise a sessions query failure as an empty list', async () => {
    const error = new Error('database unavailable')
    mockQueryResponses({ session: [{ data: null, error }, { data: null, count: 0 }] })

    await expect(getSessionsPage('g1')).rejects.toBe(error)
  })
})

describe('getSessionsPage', () => {
  it('does not request an OPEN range beyond the available rows', async () => {
    const rangeError = {
      code: 'PGRST103',
      message: 'Requested range not satisfiable',
    }
    mockQueryResponses({
      session: [
        query => query.range.mock.calls.length > 0
          ? { data: null, count: null, error: rangeError }
          : { data: null, count: 0 },
        { data: null, count: 15 },
        {
          data: [{
            id: 's11',
            date: '2026-08-01',
            description: null,
            exchange_rate: 40,
            status: 'SETTLED',
            started_at: null,
          }],
        },
      ],
      session_participant: [{ data: [{ session_id: 's11', player_id: 'alice', final_chips: 3000 }] }],
      buy_in: [{ data: [{ session_id: 's11', player_id: 'alice', amount: 2000 }] }],
      player: [{ data: [{ id: 'alice', name: 'Alice' }] }],
    })

    await expect(getSessionsPage('g1', 2)).resolves.toMatchObject({
      page: 2,
      total: 15,
      sessions: [{ id: 's11' }],
    })
  })

  it('paginates settled sessions after pinned open sessions', async () => {
    mockQueryResponses({
      session: [
        { data: null, count: 2 },
        { data: null, count: 25 },
        {
          data: [{
            id: 's11',
            date: '2026-08-01',
            description: null,
            exchange_rate: 40,
            status: 'SETTLED',
            started_at: null,
          }],
        },
      ],
      session_participant: [{ data: [{ session_id: 's11', player_id: 'alice', final_chips: 3000 }] }],
      buy_in: [{ data: [{ session_id: 's11', player_id: 'alice', amount: 2000 }] }],
      player: [{ data: [{ id: 'alice', name: 'Alice' }] }],
    })

    const result = await getSessionsPage('g1', 2)

    const [openCountQuery, settledCountQuery, settledQuery] = dbMocks.chains.filter(query => query.table === 'session')
    expect(openCountQuery.eq).toHaveBeenCalledWith('status', 'OPEN')
    expect(openCountQuery.range).not.toHaveBeenCalled()
    expect(settledCountQuery.eq).toHaveBeenCalledWith('status', 'SETTLED')
    expect(settledCountQuery.range).not.toHaveBeenCalled()
    expect(settledQuery.range).toHaveBeenCalledWith(8, 17)
    expect(result).toMatchObject({
      page: 2,
      page_size: 10,
      total: 27,
      total_pages: 3,
      sessions: [{ id: 's11', winner: { name: 'Alice', player_id: 'alice' } }],
    })
  })
})

describe('getLeaderboardData', () => {
  it('builds sessions and players from one settled-session result scan', async () => {
    mockQueryResponses({
      session: [{ data: [{ id: 's1', date: '2026-01-10', exchange_rate: 40 }] }],
      group_player: [{ data: [{
        id: 'gp-active', group_id: 'g1', player_id: 'active', created_at: '2026-01-01', updated_at: '2026-01-01', deleted_at: null,
      }] }],
      player: [
        { data: [{ id: 'active', name: 'Active', created_at: '2026-01-01' }] },
        { data: [{ id: 'alice', name: 'Alice', created_at: '2025-01-01' }] },
      ],
      session_participant: [{
        data: [
          { session_id: 's1', player_id: 'alice', final_chips: 5000 },
          { session_id: 's1', player_id: 'active', final_chips: 0 },
        ],
      }],
      buy_in: [{
        data: [{ session_id: 's1', player_id: 'alice', amount: 2500 }],
      }],
    })

    const data = await getLeaderboardData('g1')

    expect(dbMocks.chains.filter(query => query.table === 'session')).toHaveLength(1)
    expect(dbMocks.chains.filter(query => query.table === 'session_participant')).toHaveLength(1)
    expect(data.players.map(player => player.id)).toEqual(['alice', 'active'])
    expect(data.sessions).toEqual([
      {
        id: 's1',
        date: '2026-01-10',
        exchange_rate: 40,
        session_entries: [{
          player_id: 'alice',
          chips: 2500,
          final_chips: 5000,
          total_buyin: 2500,
          buy_in_count: 1,
        }, {
          player_id: 'active',
          chips: 0,
          final_chips: 0,
          total_buyin: 0,
          buy_in_count: 0,
        }],
      },
    ])
  })
})

describe('getSessionPageData', () => {
  it('loads a settled session once and only fetches names for its participants', async () => {
    mockQueryResponses({
      session: [{ data: { id: 's1', date: '2026-08-08', description: null, exchange_rate: 40, buy_in_unit: 2000, started_at: null, status: 'SETTLED' } }],
      session_participant: [{ data: [{ id: 'part-1', player_id: 'alice', final_chips: 6000 }] }],
      buy_in: [{ data: [{ id: 'buy-1', player_id: 'alice', amount: 2000, created_at: '2026-08-08T06:59:27Z' }] }],
      player: [{ data: [{ id: 'alice', name: 'Alice' }] }],
    })

    const result = await getSessionPageData('g1', 's1')

    expect(dbMocks.chains.filter(query => query.table === 'session')).toHaveLength(1)
    expect(dbMocks.chains.find(query => query.table === 'player')?.in)
      .toHaveBeenCalledWith('id', ['alice'])
    expect(result).toMatchObject({
      status: 'SETTLED',
      session: {
        id: 's1',
        session_entries: [{ player_id: 'alice', players: { name: 'Alice' } }],
      },
    })
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
