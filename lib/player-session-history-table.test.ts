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

function renderTable(): string {
  return renderToStaticMarkup(
    createElement(PlayerSessionHistoryTable, { groupId: 'g1', rows: [row] }),
  )
}

function classTokensFor(markup: string, tag: 'th' | 'td'): string[][] {
  return [...markup.matchAll(new RegExp(`<${tag}\\b[^>]* class="([^"]*)"`, 'g'))]
    .map(match => match[1].split(/\s+/))
}

describe('PlayerSessionHistoryTable', () => {
  it('renders concise mobile cumulative headers alongside the desktop labels', () => {
    const html = renderTable()

    expect(html).toContain('<span class="sm:hidden">CUM. CNY</span>')
    expect(html).toContain('<span class="hidden sm:inline">CUMULATIVE CNY</span>')
    expect(html).toContain('<span class="sm:hidden">CUM. CHIPS</span>')
    expect(html).toContain('<span class="hidden sm:inline">CUMULATIVE CHIPS</span>')
  })

  it('keeps explicit horizontal spacing between every header and data cell', () => {
    const html = renderTable()

    for (const tag of ['th', 'td'] as const) {
      const cellClasses = classTokensFor(html, tag)
      expect(cellClasses).toHaveLength(5)
      for (const tokens of cellClasses) {
        expect(tokens).toEqual(expect.arrayContaining([
          'px-1',
          'first:pl-0',
          'last:pr-0',
        ]))
      }
    }
  })
})
