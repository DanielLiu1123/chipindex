import { readFileSync } from 'node:fs'
import { createElement, type ComponentType } from 'react'
import * as React from 'react'
import * as ReactJsxRuntime from 'react/jsx-runtime'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { beforeEach, describe, expect, it } from 'vitest'
import type { HistoryPoint } from './stats'

type PlayerChartProps = {
  data: HistoryPoint[]
  positive: boolean
  mode: 'chips' | 'cny'
  chartType: 'line' | 'candle'
}

type PlayerStatsChartProps = {
  id: string
  initialName: string
  data: HistoryPoint[]
  totalCny: number
  totalChips: number
  sessions: number
  wins: number
  pogCount: number
}

const captured = {
  playerCharts: [] as PlayerChartProps[],
}

function loadPlayerStatsChart(): ComponentType<PlayerStatsChartProps> {
  // Vitest preserves JSX from the Next.js tsconfig, so transpile before injecting child mocks.
  const source = readFileSync(
    new URL('../components/PlayerStatsChart.tsx', import.meta.url),
    'utf8',
  )
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText
  const module = { exports: {} as Record<string, unknown> }
  const mocks: Record<string, unknown> = {
    react: React,
    'react/jsx-runtime': ReactJsxRuntime,
    '@/components/PlayerChart': {
      __esModule: true,
      default: (props: PlayerChartProps) => {
        captured.playerCharts.push(props)
        return null
      },
    },
    '@/components/ChipValue': { __esModule: true, default: () => null },
    '@/components/PlayerNameEditor': { __esModule: true, default: () => null },
  }
  const requireMock = (specifier: string) => {
    if (!(specifier in mocks)) throw new Error(`Unexpected import: ${specifier}`)
    return mocks[specifier]
  }

  Function('require', 'module', 'exports', output)(requireMock, module, module.exports)
  return module.exports.default as ComponentType<PlayerStatsChartProps>
}

const PlayerStatsChart = loadPlayerStatsChart()

const point: HistoryPoint = {
  date: '2026-07-25',
  session_id: 'session-1',
  chips: 1500,
  cumulative: 4500,
  cny: 37.5,
  cumulative_cny: 112.5,
  description: 'late-night game',
  buy_in_count: 3,
  total_buyin: 6000,
  final_chips: 7500,
  chips_candle: { open: 3000, high: 4500, low: -3000, close: 4500 },
  cny_candle: { open: 75, high: 112.5, low: -75, close: 112.5 },
}

function renderStats(data: HistoryPoint[]) {
  return renderToStaticMarkup(createElement(PlayerStatsChart, {
    id: 'player-1',
    initialName: 'Ada',
    data,
    totalCny: -12.5,
    totalChips: 500,
    sessions: 1,
    wins: 1,
    pogCount: 1,
  }))
}

beforeEach(() => {
  captured.playerCharts.length = 0
})

describe('PlayerStatsChart', () => {
  it('renders one history point with the default chart and value controls', () => {
    const data = [point]
    const markup = renderStats(data)

    expect(captured.playerCharts).toHaveLength(1)
    expect(captured.playerCharts[0]).toMatchObject({
      positive: false,
      mode: 'cny',
      chartType: 'line',
    })
    expect(captured.playerCharts[0].data).toBe(data)
    expect(markup.match(/role="group"/g) ?? []).toHaveLength(2)
    expect(markup).toContain('aria-label="Chart type"')
    expect(markup).toContain('aria-label="Value unit"')
    expect(markup).toContain('CUMULATIVE CNY')

    const buttons = markup.match(/<button\b[^>]*>.*?<\/button>/g) ?? []
    expect(buttons).toHaveLength(4)
    expect(buttons.map(button => button.match(/>([^<]+)<\/button>/)?.[1])).toEqual([
      'LINE',
      'CANDLE',
      'CNY',
      'CHIPS',
    ])
    for (const button of buttons) expect(button).toContain('type="button"')
    expect(buttons[0]).toContain('aria-pressed="true"')
    expect(buttons[1]).toContain('aria-pressed="false"')
    expect(buttons[2]).toContain('aria-pressed="true"')
    expect(buttons[3]).toContain('aria-pressed="false"')
  })

  it('omits the chart and controls without history data', () => {
    const markup = renderStats([])

    expect(captured.playerCharts).toHaveLength(0)
    expect(markup).not.toContain('role="group"')
    expect(markup).not.toContain('aria-label="Chart type"')
    expect(markup).not.toContain('aria-label="Value unit"')
  })
})
