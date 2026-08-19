import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'
import { createElement, Fragment, type ReactNode } from 'react'
import * as ReactJsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

interface Entry {
  id: string
  player_id: string
  chips: number
  final_chips: number | null
  total_buyin: number
  buy_ins: { amount: number; created_at: string }[]
  players: { name: string }
}

type SessionEntriesTableComponent = (props: {
  entries: Entry[]
  exchangeRate: number
  total: number
}) => ReactNode

function loadSessionEntriesTable(): SessionEntriesTableComponent {
  const source = readFileSync(
    new URL('../components/SessionEntriesTable.tsx', import.meta.url),
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
    react: {
      Fragment,
      useState: () => [new Set(['part-1']), () => undefined],
    },
    'react/jsx-runtime': ReactJsxRuntime,
    'next/link': {
      __esModule: true,
      default: ({ children, ...props }: { children: ReactNode }) =>
        createElement('a', props, children),
    },
    '@/components/ChipValue': {
      __esModule: true,
      default: ({ chips, prefix = '' }: { chips: number; prefix?: string }) =>
        createElement('span', null, `${prefix}${chips}`),
    },
    '@/lib/settlement': { toCny: (chips: number, rate: number) => chips / rate },
  }
  const requireMock = (specifier: string) => {
    if (!(specifier in mocks)) throw new Error(`Unexpected import: ${specifier}`)
    return mocks[specifier]
  }

  Function('require', 'module', 'exports', output)(requireMock, module, module.exports)
  return module.exports.default as SessionEntriesTableComponent
}

const SessionEntriesTable = loadSessionEntriesTable()

describe('SessionEntriesTable', () => {
  it('renders expanded buy-ins vertically with their local times', () => {
    const html = renderToStaticMarkup(createElement(SessionEntriesTable, {
      entries: [{
        id: 'part-1',
        player_id: 'alice',
        chips: 1000,
        final_chips: 6000,
        total_buyin: 5000,
        buy_ins: [
          { amount: 2000, created_at: '2026-08-08T06:59:27' },
          { amount: 3000, created_at: '2026-08-08T09:56:18' },
        ],
        players: { name: 'Alice' },
      }],
      exchangeRate: 40,
      total: 1000,
    }))

    expect(html).toContain('class="flex flex-col gap-1"')
    expect(html).toContain('06:59 · +2,000')
    expect(html).toContain('09:56 · +3,000')
    expect(html).toContain('TOTAL</span>5,000')
    expect(html).toContain('FINAL</span>6,000')
  })
})
