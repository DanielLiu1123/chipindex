import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({
  from: vi.fn(),
  chains: [] as Array<{
    table: string
    insert: ReturnType<typeof vi.fn>
  }>,
}))

vi.mock('./db', () => ({ db: { from: dbMocks.from } }))

import { updateSettledSession } from './session-mutations'

type QueryResponse = { data?: unknown; error: { message: string } | null }

function mockDatabase(responses: Record<string, QueryResponse[]>): void {
  dbMocks.from.mockImplementation((table: string) => {
    const response = responses[table]?.shift()
    if (!response) throw new Error(`No mock response configured for ${table}`)
    const chain: Record<string, unknown> = {
      table,
      then: (onFulfilled: (value: QueryResponse) => unknown) => Promise.resolve(response).then(onFulfilled),
    }
    for (const method of ['select', 'eq', 'is', 'in', 'maybeSingle', 'update', 'delete', 'insert']) {
      chain[method] = vi.fn().mockReturnValue(chain)
    }
    dbMocks.chains.push(chain as unknown as (typeof dbMocks.chains)[number])
    return chain
  })
}

beforeEach(() => {
  dbMocks.from.mockReset()
  dbMocks.chains.length = 0
})

describe('updateSettledSession', () => {
  it('preserves existing settlement times and uses the session end for new participants', async () => {
    mockDatabase({
      session: [
        { data: { status: 'SETTLED', ended_at: '2026-08-14T13:00:00.000Z' }, error: null },
        { error: null },
      ],
      session_participant: [
        { data: [{ player_id: 'p1', settled_at: '2026-08-14T12:30:00.000Z' }], error: null },
        { error: null },
        { error: null },
      ],
      group_player: [{ data: [{ player_id: 'p2' }], error: null }],
      buy_in: [{ error: null }, { error: null }],
    })

    await updateSettledSession('g1', 's1', {
      date: '2026-08-14', exchange_rate: 40, description: null,
    }, [
      { player_id: 'p1', final_chips: 100, buy_ins: [{ amount: 100, created_at: '2026-08-14T11:00:00.000Z' }] },
      { player_id: 'p2', final_chips: 200, buy_ins: [{ amount: 200, created_at: '2026-08-14T12:00:00.000Z' }] },
    ], false)

    const participantInsert = dbMocks.chains
      .filter(chain => chain.table === 'session_participant')
      .find(chain => chain.insert.mock.calls.length > 0)?.insert
    expect(participantInsert).toHaveBeenCalledWith([
      { session_id: 's1', player_id: 'p1', final_chips: 100, settled_at: '2026-08-14T12:30:00.000Z' },
      { session_id: 's1', player_id: 'p2', final_chips: 200, settled_at: '2026-08-14T13:00:00.000Z' },
    ])
  })
})
