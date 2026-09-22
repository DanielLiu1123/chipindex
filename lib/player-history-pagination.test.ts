import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { loadUiModule } from './test-ui'
import type { PlayerDetail } from './domain-types'
import type { HistoryPoint } from './stats'

type Query = { page?: string | string[]; page_size?: string | string[] }

function fixture(count: number): PlayerDetail {
  return { id: 'p1', name: 'Player', group_player: null, entries: Array.from({ length: count }, (_, i) => ({
    session_id: `s${i + 1}`, chips: 100, final_chips: 2100, total_buyin: 2000, buy_in_count: 1,
    sessions: { id: `s${i + 1}`, date: `2026-08-${String(i + 1).padStart(2, '0')}`, description: null,
      exchange_rate: 40, started_at: null,
      session_entries: [{ player_id: 'p1', chips: 100, final_chips: 2100, total_buyin: 2000, buy_in_count: 1 }] },
  })) }
}

async function renderPage(query: Query, count = 23) {
  let chart: { data: HistoryPoint[]; totalChips: number; sessions: number; wins: number; pogCount: number } | undefined
  const { default: Page } = loadUiModule<{ default: (props: {
    params: Promise<{ groupId: string; id: string }>; searchParams: Promise<Query>
  }) => Promise<ReactNode> }>(new URL('../app/groups/[groupId]/players/[id]/page.tsx', import.meta.url), {
    'next/navigation': { notFound: () => { throw new Error('404') }, redirect: (url: string) => { throw new Error(`redirect:${url}`) } },
    'next/link': { __esModule: true, default: ({ children, ...props }: { children: ReactNode }) => createElement('a', props, children) },
    '@/lib/queries': { getPlayerDetail: async () => fixture(count) },
    '@/components/PlayerStatsChart': { __esModule: true, default: (props: NonNullable<typeof chart>) => { chart = props; return null } },
  })
  const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ groupId: 'g1', id: 'p1' }), searchParams: Promise.resolve(query) }))
  return { html, chart }
}

describe('player session history pagination', () => {
  it('pages newest-first rows without resetting cumulative values or truncating chart statistics', async () => {
    const { html, chart } = await renderPage({ page: '2', page_size: '10' })
    expect((html.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0].match(/<tr /g) ?? [])).toHaveLength(10)
    expect(html).toContain('/sessions/s13')
    expect(html).toContain('/sessions/s4')
    expect(html).not.toContain('/sessions/s14')
    expect(html).not.toContain('/sessions/s3"')
    expect(html).toContain('+1,300')
    expect(html).toContain('/players/p1?page=3&amp;page_size=10')
    expect(chart).toMatchObject({ totalChips: 2300, sessions: 23, wins: 23, pogCount: 23 })
    expect(chart?.data).toHaveLength(23)
  })

  it('renders the partial last page and retains a custom page size in navigation', async () => {
    const { html } = await renderPage({ page: '5', page_size: '5' })
    expect((html.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0].match(/<tr /g) ?? [])).toHaveLength(3)
    expect(html).toContain('/players/p1?page=4&amp;page_size=5')
    expect(html).toContain('aria-label="Next page" aria-disabled="true"')
  })

  it('canonicalizes missing, invalid and out-of-range parameters like the session list', async () => {
    await expect(renderPage({})).rejects.toThrow('redirect:/groups/g1/players/p1?page=1&page_size=10')
    await expect(renderPage({ page: '-1', page_size: 'bad' })).rejects.toThrow('page=1&page_size=10')
    await expect(renderPage({ page: '99', page_size: '10' })).rejects.toThrow('page=3&page_size=10')
    await expect(renderPage({ page: '1', page_size: '500' })).rejects.toThrow('page=1&page_size=100')
  })

  it('shows an empty state without pagination for a player with no sessions', async () => {
    const { html, chart } = await renderPage({ page: '1', page_size: '10' }, 0)
    expect(html).toContain('NO SESSIONS YET')
    expect(html).not.toContain('Sessions pagination')
    expect(chart?.sessions).toBe(0)
  })
})
