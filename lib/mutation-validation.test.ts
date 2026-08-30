import { describe, expect, it, vi } from 'vitest'

const dbMocks = vi.hoisted(() => ({ from: vi.fn() }))

vi.mock('./db', () => ({ db: { from: dbMocks.from } }))

import { importSession, startSession } from './session-mutations'

const meta = { date: '2026-08-14', exchange_rate: 40, description: null }

describe('session player validation', () => {
  it('rejects duplicate players before creating an imported session', async () => {
    await expect(importSession('g1', meta, [
      { player_id: 'p1', chips: 100 },
      { player_id: 'p1', chips: -100 },
    ])).rejects.toMatchObject({ status: 400, message: 'Duplicate player_id' })
    expect(dbMocks.from).not.toHaveBeenCalled()
  })

  it('rejects duplicate players before creating a live session', async () => {
    await expect(startSession('g1', meta, [
      { player_id: 'p1', initial_buyin: 1000 },
      { player_id: 'p1', initial_buyin: 1000 },
    ])).rejects.toMatchObject({ status: 400, message: 'Duplicate player_id' })
    expect(dbMocks.from).not.toHaveBeenCalled()
  })

  it('rejects a zero initial buy-in before creating a live session', async () => {
    await expect(startSession('g1', meta, [
      { player_id: 'p1', initial_buyin: 0 },
    ])).rejects.toMatchObject({ status: 400, message: 'initial_buyin must be a positive integer' })
    expect(dbMocks.from).not.toHaveBeenCalled()
  })
})
