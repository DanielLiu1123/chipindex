import { beforeEach, describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({ from: vi.fn(), chains: [] as Array<{ table: string; update: ReturnType<typeof vi.fn> }> }))

vi.mock('./db', () => ({ db: { from: dbMocks.from } }))

import { addBuyin, addParticipant, cashOutParticipant, removeParticipant, revokeBuyin, settleSession, undoParticipantCashOut } from './live-session-mutations'

type QueryResponse = { data: unknown; error: { message: string } | null }

function mockResponses(responses: Record<string, QueryResponse[]>) {
  dbMocks.from.mockImplementation((table: string) => {
    const response = responses[table]?.shift()
    if (!response) throw new Error(`No mock response configured for ${table}`)
    const chain: Record<string, ReturnType<typeof vi.fn> | ((resolve: (value: QueryResponse) => unknown) => Promise<unknown>)> = {}
    for (const method of ['select', 'update', 'eq', 'is', 'not', 'maybeSingle']) {
      chain[method] = vi.fn().mockReturnValue(chain)
    }
    chain.then = (resolve: (value: QueryResponse) => unknown) => Promise.resolve(response).then(resolve)
    dbMocks.chains.push({ table, update: chain.update as ReturnType<typeof vi.fn> })
    return chain
  })
}

beforeEach(() => {
  dbMocks.from.mockReset()
  dbMocks.chains.length = 0
})

describe('session settlement with cashed-out participants', () => {
  it('keeps frozen results and only settles active participants', async () => {
    mockResponses({
      session: [
        { data: { status: 'OPEN' }, error: null },
        { data: null, error: null },
      ],
      session_participant: [
        { data: [
          { player_id: 'p1', final_chips: 4000, settled_at: '2026-08-19T12:00:00Z' },
          { player_id: 'p2', final_chips: null, settled_at: null },
        ], error: null },
        { data: { id: 'part-2' }, error: null },
      ],
      buy_in: [{ data: [{ amount: 4000 }, { amount: 4000 }], error: null }],
    })

    await expect(settleSession('g1', 's1', [{ player_id: 'p2', final_chips: 4000 }], false))
      .resolves.toEqual({ id: 's1', diff: 0 })

    const participantUpdates = dbMocks.chains.filter(chain => chain.table === 'session_participant' && chain.update.mock.calls.length > 0)
    expect(participantUpdates).toHaveLength(1)
    expect(participantUpdates[0].update).toHaveBeenCalledWith(expect.objectContaining({ final_chips: 4000 }))
  })

  it('rejects a client attempt to overwrite frozen final chips', async () => {
    mockResponses({
      session: [{ data: { status: 'OPEN' }, error: null }],
      session_participant: [{ data: [
        { player_id: 'p1', final_chips: 4000, settled_at: '2026-08-19T12:00:00Z' },
      ], error: null }],
    })

    await expect(settleSession('g1', 's1', [{ player_id: 'p1', final_chips: 5000 }], false))
      .rejects.toMatchObject({ status: 409, message: 'Frozen final_chips do not match for participant p1' })
  })
})

describe('participant cash out', () => {
  it('locks final chips at the participant settlement time', async () => {
    mockResponses({
      session: [{ data: { status: 'OPEN' }, error: null }],
      session_participant: [
        { data: { id: 'part-1', settled_at: null }, error: null },
        { data: { player_id: 'p1', final_chips: 5600, settled_at: '2026-08-19T12:00:00Z' }, error: null },
      ],
    })

    await expect(cashOutParticipant('g1', 's1', 'p1', 5600)).resolves.toMatchObject({
      player_id: 'p1',
      final_chips: 5600,
    })
  })

  it('rejects cashing out an already settled participant', async () => {
    mockResponses({
      session: [{ data: { status: 'OPEN' }, error: null }],
      session_participant: [{ data: { id: 'part-1', settled_at: '2026-08-19T12:00:00Z' }, error: null }],
    })

    await expect(cashOutParticipant('g1', 's1', 'p1', 5600)).rejects.toMatchObject({
      status: 409,
      message: 'Participant has already cashed out',
    })
  })

  it('undoes cash out while the session is open', async () => {
    mockResponses({
      session: [{ data: { status: 'OPEN' }, error: null }],
      session_participant: [
        { data: { id: 'part-1', settled_at: '2026-08-19T12:00:00Z' }, error: null },
        { data: { player_id: 'p1', final_chips: null, settled_at: null }, error: null },
      ],
    })

    await expect(undoParticipantCashOut('g1', 's1', 'p1')).resolves.toMatchObject({
      player_id: 'p1',
      final_chips: null,
      settled_at: null,
    })
  })

  it('blocks buy-in changes and participant removal after cash out', async () => {
    for (const action of [
      () => addBuyin('g1', 's1', 'p1', 2000),
      () => addParticipant('g1', 's1', 'p1'),
      () => revokeBuyin('g1', 's1', 'b1'),
      () => removeParticipant('g1', 's1', 'p1'),
    ]) {
      dbMocks.from.mockReset()
      mockResponses({
        session: [{ data: { status: 'OPEN' }, error: null }],
        session_participant: [{ data: { id: 'part-1', settled_at: '2026-08-19T12:00:00Z' }, error: null }],
        buy_in: [{ data: { player_id: 'p1' }, error: null }],
      })
      await expect(action()).rejects.toMatchObject({ status: 409 })
    }
  })
})
