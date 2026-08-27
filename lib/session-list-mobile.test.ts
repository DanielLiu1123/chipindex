import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import SessionList from '@/components/SessionList'
import type { SessionRow } from '@/lib/queries'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: () => undefined }),
}))

const sessions: SessionRow[] = [{
  id: 's1',
  date: '2026-08-28',
  description: 'Friday game',
  exchange_rate: 40,
  status: 'SETTLED',
  player_count: 6,
  winner: { name: 'Ada Lovelace', player_id: 'p1' },
}]

describe('SessionList mobile rendering', () => {
  it('renders readable mobile cards without dropping session details', () => {
    const html = renderToStaticMarkup(createElement(SessionList, {
      groupId: 'g1',
      sessions,
    }))

    expect(html).toContain('aria-label="Sessions"')
    expect(html).toContain('class="sm:hidden"')
    expect(html).toContain('class="hidden w-full text-sm sm:table"')
    expect(html).toContain('Friday game')
    expect(html).toContain('6 PLAYERS')
    expect(html).toContain('WINNER')
    expect(html).toContain('Ada Lovelace')
    expect(html).toContain('40:1')
    expect(html).toContain('DELETE')
  })
})
