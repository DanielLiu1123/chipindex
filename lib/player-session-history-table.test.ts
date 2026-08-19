import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'
import { createElement, type ReactNode } from 'react'
import * as ReactJsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

interface HistoryRow {
  date: string
  cny: number
  chips: number
  cumulative_cny: number
  cumulative: number
  session_id: string
}

type PlayerSessionHistoryTableComponent = (props: { rows: HistoryRow[] }) => ReactNode

function loadPlayerSessionHistoryTable(): PlayerSessionHistoryTableComponent {
  const source = readFileSync(
    new URL('../components/PlayerSessionHistoryTable.tsx', import.meta.url),
    'utf8',
  )
  const output = transformSync(source, {
    format: 'cjs',
    jsx: 'automatic',
    loader: 'tsx',
    target: 'es2020',
  }).code
  const module = { exports: {} as Record<string, unknown> }
  const mocks: Record<string, unknown> = {
    'react/jsx-runtime': ReactJsxRuntime,
    'next/link': {
      __esModule: true,
      default: ({ children, ...props }: { children: ReactNode }) =>
        createElement('a', props, children),
    },
    '@/components/ChipValue': {
      __esModule: true,
      default: ({ chips, prefix = '' }: { chips: number, prefix?: string }) =>
        createElement('span', null, `${prefix}${chips}`),
    },
  }
  const requireMock = (specifier: string) => {
    if (!(specifier in mocks)) throw new Error(`Unexpected import: ${specifier}`)
    return mocks[specifier]
  }

  Function('require', 'module', 'exports', output)(requireMock, module, module.exports)
  return module.exports.default as PlayerSessionHistoryTableComponent
}

const PlayerSessionHistoryTable = loadPlayerSessionHistoryTable()

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
    createElement(PlayerSessionHistoryTable, { rows: [row] }),
  )
}

function classTokensFor(markup: string, tag: 'th' | 'td'): string[][] {
  return [...markup.matchAll(new RegExp(`<${tag} class="([^"]*)"`, 'g'))]
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
