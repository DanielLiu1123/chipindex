import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  createPlayerInGroup: vi.fn(),
}))

vi.mock('@/lib/client', () => mocks)

import { resolvePlayerId } from '@/hooks/usePlayerRows'

beforeEach(() => {
  mocks.api.mockReset()
  mocks.createPlayerInGroup.mockReset()
})

describe('resolvePlayerId', () => {
  it('returns the player id from the create-player response', async () => {
    mocks.createPlayerInGroup.mockResolvedValue({
      player: { id: 'p1', name: 'Alice', created_at: '2026-08-14T00:00:00Z' },
      group_player: {
        id: 'gp1',
        group_id: 'g1',
        player_id: 'p1',
        created_at: '2026-08-14T00:00:00Z',
        updated_at: '2026-08-14T00:00:00Z',
        deleted_at: null,
      },
    })

    await expect(resolvePlayerId('g1', {
      uid: 'row1',
      playerId: '',
      isNew: true,
      newName: ' Alice ',
    })).resolves.toBe('p1')
  })
})
