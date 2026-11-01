import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PlayerSessionHistoryTable from '../components/PlayerSessionHistoryTable'

const row = {
  date: '2026-07-25',
  cny: 37.5,
  chips: 1500,
  cumulative_cny: 112.5,
  cumulative: 4500,
  session_id: 's1',
}

function renderTable(loading = false): string {
  return renderToStaticMarkup(
    createElement(PlayerSessionHistoryTable, { groupId: 'g1', rows: [row], loading }),
  )
}

describe('PlayerSessionHistoryTable', () => {
  it('renders concise mobile cumulative headers alongside the desktop labels', () => {
    const html = renderTable()

    expect(html).toContain('<span class="sm:hidden">CUM. CNY</span>')
    expect(html).toContain('<span class="hidden sm:inline">CUMULATIVE CNY</span>')
    expect(html).toContain('<span class="sm:hidden">CUM. CHIPS</span>')
    expect(html).toContain('<span class="hidden sm:inline">CUMULATIVE CHIPS</span>')
  })

  it('uses the same table geometry for loading without exposing stale data or links', () => {
    const content = renderTable()
    const loading = renderTable(true)
    for (const tag of ['tr', 'th', 'td']) {
      const pattern = new RegExp(`<${tag}\\b`, 'g')
      expect(loading.match(pattern)).toHaveLength(content.match(pattern)!.length)
    }
    expect(loading).not.toContain(row.date)
    expect(loading).not.toContain('href=')
    expect(content).toContain('/groups/g1/sessions/s1')
    expect(content).toContain('+¥37.5')
    expect(content).toContain('+4,500')
  })
})
