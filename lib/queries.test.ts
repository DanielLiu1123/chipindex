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
  getAllPlayers,
  getGroupPlayers,
  getLeaderboardData,
  getPlayerDetail,
  getSessionForEdit,
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

  it('uses player id to break a tied winner net', async () => {
    mockQueryResponses({
      session: [
        { data: null, count: 0 },
        { data: null, count: 1 },
        { data: [{ id: 's1', date: '2026-08-01', description: null, exchange_rate: 40, status: 'SETTLED', started_at: null }] },
      ],
      session_participant: [{ data: [
        { session_id: 's1', player_id: 'player-b', final_chips: 4000 },
        { session_id: 's1', player_id: 'player-a', final_chips: 3000 },
      ] }],
      buy_in: [{ data: [
        { session_id: 's1', player_id: 'player-b', amount: 2000 },
        { session_id: 's1', player_id: 'player-a', amount: 1000 },
      ] }],
      player: [{ data: [
        { id: 'player-b', name: 'A', created_at: '2026-01-01' },
        { id: 'player-a', name: 'Z', created_at: '2026-01-01' },
      ] }],
    })

    const result = await getSessionsPage('g1')

    expect(result.sessions[0].winner).toEqual({ name: 'Z', player_id: 'player-a' })
  })
})

describe('player ordering', () => {
  it('orders group players by group join time, then player id', async () => {
    mockQueryResponses({
      group_player: [{ data: [
        { id: 'membership-a', group_id: 'g1', player_id: 'player-b', created_at: '2026-08-02', updated_at: '2026-08-02', deleted_at: null },
        { id: 'membership-z', group_id: 'g1', player_id: 'player-a', created_at: '2026-08-02', updated_at: '2026-08-02', deleted_at: null },
        { id: 'membership-old', group_id: 'g1', player_id: 'old-player', created_at: '2026-08-01', updated_at: '2026-08-01', deleted_at: null },
      ] }],
      player: [{ data: [
        { id: 'player-b', name: 'A', created_at: '2026-01-01', updated_at: '2026-01-01', deleted_at: null },
        { id: 'player-a', name: 'Z', created_at: '2026-01-03', updated_at: '2026-01-03', deleted_at: null },
        { id: 'old-player', name: 'Old', created_at: '2026-01-04', updated_at: '2026-01-04', deleted_at: null },
      ] }],
    })

    const rows = await getGroupPlayers('g1')

    expect(rows.map(row => row.player.id)).toEqual(['old-player', 'player-a', 'player-b'])
  })

  it('requests all players by creation time, then player id', async () => {
    mockQueryResponses({ player: [{ data: [] }] })

    await getAllPlayers()

    expect(dbMocks.chains[0].order.mock.calls).toEqual([
      ['created_at'],
      ['id'],
    ])
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
  it('exposes frozen final chips and participant settlement time for an open session', async () => {
    mockQueryResponses({
      session: [{ data: { id: 's1', date: '2026-08-19', description: null, exchange_rate: 40, buy_in_unit: 2000, started_at: null, status: 'OPEN' } }],
      session_participant: [{ data: [{ id: 'part-1', player_id: 'alice', final_chips: 5600, settled_at: '2026-08-19T14:36:00Z', created_at: '2026-08-19T12:00:00Z' }] }],
      buy_in: [{ data: [{ id: 'buy-1', player_id: 'alice', amount: 4000, created_at: '2026-08-19T12:00:00Z' }] }],
      player: [{ data: [{ id: 'alice', name: 'Alice' }] }],
    })

    const result = await getSessionPageData('g1', 's1')

    expect(dbMocks.chains.find(query => query.table === 'session_participant')?.select)
      .toHaveBeenCalledWith('id, player_id, final_chips, settled_at, created_at')
    expect(result).toMatchObject({
      status: 'OPEN',
      session: {
        participants: [{
          player_id: 'alice',
          final_chips: 5600,
          settled_at: '2026-08-19T14:36:00Z',
        }],
      },
    })
  })

  it('orders live participants by session join time, then player id', async () => {
    mockQueryResponses({
      session: [{ data: { id: 's1', date: '2026-08-19', description: null, exchange_rate: 40, buy_in_unit: 2000, started_at: null, status: 'OPEN' } }],
      session_participant: [{ data: [
        { id: 'part-new', player_id: 'new-player', final_chips: null, settled_at: null, created_at: '2026-08-03T00:00:00Z' },
        { id: 'part-b', player_id: 'same-time-b', final_chips: null, settled_at: null, created_at: '2026-08-02T00:00:00Z' },
        { id: 'part-old', player_id: 'old-player', final_chips: null, settled_at: null, created_at: '2026-08-01T00:00:00Z' },
        { id: 'part-a', player_id: 'same-time-a', final_chips: null, settled_at: null, created_at: '2026-08-02T00:00:00Z' },
      ] }],
      buy_in: [{ data: [] }],
      player: [{ data: [
        { id: 'new-player', name: 'New' },
        { id: 'same-time-b', name: 'A' },
        { id: 'old-player', name: 'Old' },
        { id: 'same-time-a', name: 'Z' },
      ] }],
    })

    const result = await getSessionPageData('g1', 's1')

    expect(dbMocks.chains.find(query => query.table === 'player')?.select)
      .toHaveBeenCalledWith('id, name')
    expect(result?.status).toBe('OPEN')
    if (result?.status !== 'OPEN') throw new Error('Expected an open session')
    expect(result.session.participants.map(participant => participant.player_id)).toEqual([
      'old-player',
      'same-time-a',
      'same-time-b',
      'new-player',
    ])
  })

  it('loads a settled session once and only fetches names for its participants', async () => {
    mockQueryResponses({
      session: [{ data: { id: 's1', date: '2026-08-08', description: null, exchange_rate: 40, buy_in_unit: 2000, started_at: '2026-08-08T09:00:00Z', ended_at: '2026-08-08T10:00:00Z', status: 'SETTLED' } }],
      session_participant: [{ data: [{ id: 'part-1', player_id: 'alice', final_chips: 6000, settled_at: '2026-08-08T09:45:00Z' }] }],
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
        started_at: '2026-08-08T09:00:00Z',
        ended_at: '2026-08-08T10:00:00Z',
        session_entries: [{
          player_id: 'alice',
          settled_at: '2026-08-08T09:45:00Z',
          players: { name: 'Alice' },
        }],
      },
    })
  })

  it('orders settled participants by net descending, then player id', async () => {
    mockQueryResponses({
      session: [{ data: { id: 's1', date: '2026-08-08', description: null, exchange_rate: 40, buy_in_unit: 2000, started_at: null, status: 'SETTLED' } }],
      session_participant: [{ data: [
        { id: 'part-low', player_id: 'low-player', final_chips: 1000, settled_at: '2026-08-08T10:00:00Z' },
        { id: 'part-b', player_id: 'same-net-b', final_chips: 4000, settled_at: '2026-08-08T10:00:00Z' },
        { id: 'part-high', player_id: 'high-player', final_chips: 6000, settled_at: '2026-08-08T10:00:00Z' },
        { id: 'part-a', player_id: 'same-net-a', final_chips: 3000, settled_at: '2026-08-08T10:00:00Z' },
      ] }],
      buy_in: [{ data: [
        { id: 'buy-low', player_id: 'low-player', amount: 2000, created_at: '2026-08-08T09:00:00Z' },
        { id: 'buy-b', player_id: 'same-net-b', amount: 2000, created_at: '2026-08-08T09:00:00Z' },
        { id: 'buy-high', player_id: 'high-player', amount: 2000, created_at: '2026-08-08T09:00:00Z' },
        { id: 'buy-a', player_id: 'same-net-a', amount: 1000, created_at: '2026-08-08T09:00:00Z' },
      ] }],
      player: [{ data: [
        { id: 'low-player', name: 'Low', created_at: '2026-08-04T00:00:00Z' },
        { id: 'same-net-b', name: 'A', created_at: '2026-08-03T00:00:00Z' },
        { id: 'high-player', name: 'High', created_at: '2026-08-02T00:00:00Z' },
        { id: 'same-net-a', name: 'Z', created_at: '2026-08-01T00:00:00Z' },
      ] }],
    })

    const result = await getSessionPageData('g1', 's1')

    expect(result?.status).toBe('SETTLED')
    if (result?.status !== 'SETTLED') throw new Error('Expected a settled session')
    expect(result.session.session_entries.map(entry => entry.player_id)).toEqual([
      'high-player',
      'same-net-a',
      'same-net-b',
      'low-player',
    ])
  })
})

describe('getSessionForEdit', () => {
  it('preserves effective buy-in, early cash-out and session end times', async () => {
    mockQueryResponses({
      session: [{ data: {
        id: 's1', date: '2026-08-08', description: null, exchange_rate: 40, buy_in_unit: 2000,
        started_at: '2026-08-08T09:00:00Z', ended_at: '2026-08-08T10:00:00Z', status: 'SETTLED',
      } }],
      session_participant: [{ data: [{
        id: 'part-1', player_id: 'alice', final_chips: 3500,
        settled_at: '2026-08-08T09:45:00Z', created_at: '2026-08-08T09:01:00Z',
      }] }],
      buy_in: [{ data: [{ id: 'buy-1', player_id: 'alice', amount: 2000, created_at: '2026-08-08T09:01:00Z' }] }],
      player: [{ data: [{ id: 'alice', name: 'Alice' }] }],
    })

    await expect(getSessionForEdit('g1', 's1')).resolves.toMatchObject({
      ended_at: '2026-08-08T10:00:00Z',
      participants: [{
        player_id: 'alice',
        settled_at: '2026-08-08T09:45:00Z',
        buy_ins: [{ created_at: '2026-08-08T09:01:00Z' }],
      }],
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
