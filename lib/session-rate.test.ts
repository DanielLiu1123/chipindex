import { beforeEach, expect, it, vi } from 'vitest'
import { parseUpdateSessionRateCommand } from './commands'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('./db', () => ({ db: { from: mocks.from } }))
import { updateLiveSessionRate } from './live-session-mutations'

function query(data: unknown, error: { message: string } | null = null) {
  const chain = {
    select: vi.fn().mockReturnThis(), update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  }
  mocks.from.mockReturnValueOnce(chain)
  return chain
}

beforeEach(() => vi.resetAllMocks())

it.each([undefined, null, '', '40', 0, -1, NaN, Infinity, true])('rejects invalid rate %s at the command boundary', rate => {
  expect(() => parseUpdateSessionRateCommand({ exchange_rate: rate })).toThrow()
})

it('accepts positive fractional rates', () => {
  expect(parseUpdateSessionRateCommand({ exchange_rate: 20.5 })).toEqual({ exchange_rate: 20.5 })
})

it('updates only the rate of the requested open session', async () => {
  const read = query({ status: 'OPEN' })
  const write = query({ id: 's1', exchange_rate: 20.5 })
  await expect(updateLiveSessionRate('g1', 's1', 20.5)).resolves.toEqual({ id: 's1', exchange_rate: 20.5 })
  expect(mocks.from.mock.calls).toEqual([['session'], ['session']])
  for (const chain of [read, write]) {
    expect(chain.eq).toHaveBeenCalledWith('group_id', 'g1')
    expect(chain.eq).toHaveBeenCalledWith('id', 's1')
    expect(chain.is).toHaveBeenCalledWith('deleted_at', null)
  }
  expect(write.eq).toHaveBeenCalledWith('status', 'OPEN')
  expect(write.update).toHaveBeenCalledWith({ exchange_rate: 20.5, updated_at: expect.any(String) })
})

it.each([0, -1, NaN, Infinity])('rejects invalid mutation input %s before querying', async rate => {
  await expect(updateLiveSessionRate('g1', 's1', rate)).rejects.toMatchObject({ code: 'invalid_input' })
  expect(mocks.from).not.toHaveBeenCalled()
})

it.each([
  [null, 'not_found'],
  [{ status: 'SETTLED' }, 'conflict'],
])('rejects unavailable sessions', async (session, code) => {
  query(session)
  await expect(updateLiveSessionRate('g1', 's1', 40)).rejects.toMatchObject({ code })
  expect(mocks.from).toHaveBeenCalledTimes(1)
})

it('rejects a session closed or deleted between reading and writing', async () => {
  query({ status: 'OPEN' })
  query(null)
  await expect(updateLiveSessionRate('g1', 's1', 40)).rejects.toMatchObject({ code: 'conflict' })
})

it('propagates database write failures', async () => {
  query({ status: 'OPEN' })
  query(null, { message: 'write failed' })
  await expect(updateLiveSessionRate('g1', 's1', 40)).rejects.toThrow('Database operation failed')
})
