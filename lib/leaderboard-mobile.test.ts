import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import LeaderboardView from '@/components/LeaderboardView'
import type { PlayerStats } from '@/lib/stats'

const stats: PlayerStats[] = [{
  player: {
    id: 'p1',
    name: 'Ada Lovelace',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
  },
  total_chips: 4500,
  total_yuan: 112.5,
  sessions_played: 12,
  wins: 7,
  win_rate: 7 / 12,
  pog_count: 3,
}]

describe('Leaderboard mobile rendering', () => {
  it('keeps every leaderboard metric available in a mobile list', () => {
    const html = renderToStaticMarkup(createElement(LeaderboardView, {
      groupId: 'g1',
      stats,
      sessions: [],
    }))

    expect(html).toContain('aria-label="Mobile leaderboard sort"')
    expect(html).toContain('aria-label="Leaderboard"')
    expect(html).toContain('class="sm:hidden"')
    expect(html).toContain('class="hidden w-full text-sm sm:table"')
    expect(html).toContain('Ada Lovelace')
    expect(html).toContain('SESSIONS')
    expect(html).toContain('WIN RATE')
    expect(html).toContain('POG')
  })
})
