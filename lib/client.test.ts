import { afterEach, describe, expect, it, vi } from 'vitest'

import { createPlayerInGroup, startSession } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('startSession', () => {
  it('owns the method, path, request and response contract', async () => {
    const payload = { id: 's1' }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(payload),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(startSession('g1', {
      status: 'OPEN',
      date: '2026-08-14',
      exchange_rate: 40,
      description: null,
      players: [{ player_id: 'p1', initial_buyin: 2000 }],
    })).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith('/api/groups/g1/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'OPEN',
        date: '2026-08-14',
        exchange_rate: 40,
        description: null,
        players: [{ player_id: 'p1', initial_buyin: 2000 }],
      }),
    })
  })
})

describe('createPlayerInGroup', () => {
  it('preserves the composite player and group_player response contract', async () => {
    const payload = {
      player: { id: 'p1', name: 'Alice', created_at: '2026-08-14T00:00:00Z' },
      group_player: {
        id: 'gp1',
        group_id: 'g1',
        player_id: 'p1',
        created_at: '2026-08-14T00:00:00Z',
        updated_at: '2026-08-14T00:00:00Z',
        deleted_at: null,
      },
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(payload),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(createPlayerInGroup('g1', 'Alice')).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith('/api/groups/g1/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    })
  })
})
