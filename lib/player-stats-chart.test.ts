import { readFileSync } from 'node:fs'
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react'
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

type ChipValueProps = {
  chips: number
  className?: string
  prefix?: string
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

type PlayerStatsChartComponent = (props: PlayerStatsChartProps) => ReactNode

type HostProps = {
  children?: ReactNode
  className?: string
  role?: string
  type?: string
  'aria-label'?: string
  'aria-pressed'?: boolean
  onClick?: () => void
}

type HostElement = ReactElement<HostProps, string>
type ButtonLabel = 'LINE' | 'CANDLE' | 'CNY' | 'CHIPS'
type StateUpdater<T> = T | ((previous: T) => T)

const captured = {
  chipValues: [] as ChipValueProps[],
  playerCharts: [] as PlayerChartProps[],
}

const hookStates: unknown[] = []
let hookCursor = 0

function useStateHarness<T>(initialState: T | (() => T)): [T, (next: StateUpdater<T>) => void] {
  const index = hookCursor++
  if (index >= hookStates.length) {
    hookStates[index] = typeof initialState === 'function'
      ? (initialState as () => T)()
      : initialState
  }

  const setState = (next: StateUpdater<T>) => {
    const previous = hookStates[index] as T
    hookStates[index] = typeof next === 'function'
      ? (next as (value: T) => T)(previous)
      : next
  }

  return [hookStates[index] as T, setState]
}

function loadPlayerStatsChart(): PlayerStatsChartComponent {
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
    react: { useState: useStateHarness },
    'react/jsx-runtime': ReactJsxRuntime,
    '@/components/PlayerChart': {
      __esModule: true,
      default: (props: PlayerChartProps) => {
        captured.playerCharts.push(props)
        return null
      },
    },
    '@/components/ChipValue': {
      __esModule: true,
      default: (props: ChipValueProps) => {
        captured.chipValues.push(props)
        return null
      },
    },
    '@/components/PlayerNameEditor': { __esModule: true, default: () => null },
  }
  const requireMock = (specifier: string) => {
    if (!(specifier in mocks)) throw new Error(`Unexpected import: ${specifier}`)
    return mocks[specifier]
  }

  Function('require', 'module', 'exports', output)(requireMock, module, module.exports)
  return module.exports.default as PlayerStatsChartComponent
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

function createStatsProps(data: HistoryPoint[]): PlayerStatsChartProps {
  return {
    id: 'player-1',
    initialName: 'Ada',
    data,
    totalCny: -12.5,
    totalChips: 500,
    sessions: 1,
    wins: 1,
    pogCount: 1,
  }
}

function renderStats(props: PlayerStatsChartProps) {
  hookCursor = 0
  const tree = PlayerStatsChart(props)
  return {
    tree,
    markup: renderToStaticMarkup(tree),
  }
}

function walkElements(node: ReactNode, visit: (element: ReactElement<HostProps>) => void) {
  Children.forEach(node, child => {
    if (!isValidElement<HostProps>(child)) return
    visit(child)
    walkElements(child.props.children, visit)
  })
}

function findHostElements(node: ReactNode, type: string): HostElement[] {
  const matches: HostElement[] = []
  walkElements(node, element => {
    if (element.type === type) matches.push(element as HostElement)
  })
  return matches
}

function findHostElement(
  node: ReactNode,
  type: string,
  predicate: (element: HostElement) => boolean,
): HostElement {
  const match = findHostElements(node, type).find(predicate)
  if (!match) throw new Error(`Expected to find a <${type}> element`)
  return match
}

function textContent(node: ReactNode): string {
  let text = ''
  Children.forEach(node, child => {
    if (typeof child === 'string' || typeof child === 'number' || typeof child === 'bigint') {
      text += String(child)
    } else if (isValidElement<HostProps>(child)) {
      text += textContent(child.props.children)
    }
  })
  return text
}

function findButton(node: ReactNode, label: ButtonLabel): HostElement {
  return findHostElement(
    node,
    'button',
    button => textContent(button.props.children) === label,
  )
}

function clickButton(node: ReactNode, label: ButtonLabel) {
  const button = findButton(node, label)
  if (!button.props.onClick) throw new Error(`Expected ${label} button to have an onClick handler`)
  button.props.onClick()
}

function expectPressedStates(node: ReactNode, expected: Record<ButtonLabel, boolean>) {
  for (const [label, pressed] of Object.entries(expected)) {
    expect(findButton(node, label as ButtonLabel).props['aria-pressed']).toBe(pressed)
  }
}

function classTokens(element: HostElement): string[] {
  return element.props.className?.split(/\s+/).filter(Boolean) ?? []
}

function expectClassTokens(element: HostElement, expected: string[]) {
  expect(classTokens(element)).toEqual(expect.arrayContaining(expected))
}

function findToolbar(node: ReactNode, title: string) {
  const toolbar = findHostElement(node, 'div', element =>
    Children.toArray(element.props.children).some(child =>
      isValidElement<HostProps>(child) &&
      child.type === 'p' &&
      textContent(child.props.children) === title,
    ),
  )
  const controls = findHostElement(toolbar.props.children, 'div', element =>
    Children.toArray(element.props.children).filter(child =>
      isValidElement<HostProps>(child) && child.type === 'div' && child.props.role === 'group',
    ).length === 2,
  )
  return { controls, toolbar }
}

function latest<T>(values: T[]): T {
  if (values.length === 0) throw new Error('Expected at least one captured value')
  return values[values.length - 1]
}

beforeEach(() => {
  hookCursor = 0
  hookStates.length = 0
  captured.chipValues.length = 0
  captured.playerCharts.length = 0
})

describe('PlayerStatsChart', () => {
  it('renders one history point with the default chart and value controls', () => {
    const data = [point]
    const { markup, tree } = renderStats(createStatsProps(data))

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
    const { controls, toolbar } = findToolbar(tree, 'CUMULATIVE CNY')
    expectClassTokens(toolbar, [
      'flex',
      'flex-wrap',
      'items-center',
      'justify-between',
      'gap-3',
      'mb-4',
      'mx-2',
    ])
    expect(classTokens(toolbar)).not.toContain('gap-4')
    expectClassTokens(controls, ['flex', 'flex-wrap', 'items-center', 'gap-4'])

    const buttons = findHostElements(tree, 'button')
    expect(buttons).toHaveLength(4)
    expect(buttons.map(button => textContent(button.props.children))).toEqual([
      'LINE',
      'CANDLE',
      'CNY',
      'CHIPS',
    ])
    for (const button of buttons) expect(button.props.type).toBe('button')
    expectPressedStates(tree, {
      LINE: true,
      CANDLE: false,
      CNY: true,
      CHIPS: false,
    })
  })

  it('keeps chart type and value mode independent across interactions', () => {
    const props = createStatsProps([point])
    let rendered = renderStats(props)

    expect(latest(captured.playerCharts)).toMatchObject({
      chartType: 'line',
      mode: 'cny',
      positive: false,
    })
    expect(latest(captured.chipValues)).toEqual({
      chips: -12.5,
      prefix: '¥',
      className: 'text-sm',
    })
    expectPressedStates(rendered.tree, {
      LINE: true,
      CANDLE: false,
      CNY: true,
      CHIPS: false,
    })

    clickButton(rendered.tree, 'CANDLE')
    rendered = renderStats(props)

    expect(latest(captured.playerCharts)).toMatchObject({
      chartType: 'candle',
      mode: 'cny',
      positive: false,
    })
    expectPressedStates(rendered.tree, {
      LINE: false,
      CANDLE: true,
      CNY: true,
      CHIPS: false,
    })

    clickButton(rendered.tree, 'CHIPS')
    rendered = renderStats(props)

    expect(latest(captured.playerCharts)).toMatchObject({
      chartType: 'candle',
      mode: 'chips',
      positive: true,
    })
    expect(textContent(rendered.tree)).toContain('CUMULATIVE CHIPS')
    expectPressedStates(rendered.tree, {
      LINE: false,
      CANDLE: true,
      CNY: false,
      CHIPS: true,
    })
    expect(latest(captured.chipValues)).toEqual({
      chips: 500,
      className: 'text-sm',
    })
  })

  it('omits the chart and controls without history data', () => {
    const { markup } = renderStats(createStatsProps([]))

    expect(captured.playerCharts).toHaveLength(0)
    expect(markup).not.toContain('role="group"')
    expect(markup).not.toContain('aria-label="Chart type"')
    expect(markup).not.toContain('aria-label="Value unit"')
  })
})
