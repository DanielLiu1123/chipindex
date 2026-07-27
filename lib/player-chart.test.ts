import {
  Fragment,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlayerCandleShape from '@/components/PlayerCandleShape'
import PlayerChart from '@/components/PlayerChart'
import type { HistoryPoint } from './stats'

type CapturedProps = Record<string, unknown> & { children?: ReactNode }

const captured = vi.hoisted(() => ({
  bars: [] as CapturedProps[],
  charts: [] as CapturedProps[],
  lines: [] as CapturedProps[],
  tooltips: [] as CapturedProps[],
  xAxes: [] as CapturedProps[],
  routerPush: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: captured.routerPush }),
}))

vi.mock('recharts', async () => {
  const { Fragment: MockFragment, createElement: mockCreateElement } = await import('react')
  const passThrough = (props: CapturedProps) =>
    mockCreateElement(MockFragment, null, props.children)
  const capture = (target: CapturedProps[]) => (props: CapturedProps) => {
    target.push(props)
    return null
  }

  return {
    Bar: capture(captured.bars),
    ComposedChart: (props: CapturedProps) => {
      captured.charts.push(props)
      return passThrough(props)
    },
    Line: capture(captured.lines),
    LineChart: passThrough,
    ReferenceLine: () => null,
    ResponsiveContainer: passThrough,
    Tooltip: capture(captured.tooltips),
    XAxis: capture(captured.xAxes),
    YAxis: () => null,
  }
})

const point: HistoryPoint = {
  date: '2026-07-25',
  session_id: 's1',
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

type ChartProps = {
  data: HistoryPoint[]
  positive: boolean
  mode: 'chips' | 'cny'
  chartType?: 'line' | 'candle'
}

type BarProps = {
  activeBar: boolean
  dataKey: (value: HistoryPoint) => [number, number]
  isAnimationActive: boolean
  maxBarSize: number
  shape: (props: CapturedProps) => ReactNode
}

type LineProps = {
  activeDot: (props: CapturedProps) => ReactNode
  dataKey: string
  dot: (props: CapturedProps) => ReactNode
  stroke: string
  strokeWidth: number
  type: string
}

type CandleElementProps = {
  ariaLabel?: string
  index: number
  labelAnchor: 'start' | 'middle' | 'end'
  mode: 'chips' | 'cny'
  onActivate: (sessionId: string) => void
  payload: HistoryPoint
  showBest: boolean
  showWorst: boolean
}

type TooltipProps = {
  content: (props: {
    active: boolean
    payload: Array<{ payload: HistoryPoint }>
  }) => ReactNode
}

type XAxisProps = {
  dataKey: string
  interval: string
  tickFormatter: (sessionId: string) => string | undefined
}

function resetCaptured() {
  captured.bars.length = 0
  captured.charts.length = 0
  captured.lines.length = 0
  captured.tooltips.length = 0
  captured.xAxes.length = 0
  captured.routerPush.mockReset()
}

function renderChart(overrides: Partial<ChartProps> = {}) {
  const props: ChartProps = {
    data: [point],
    positive: true,
    mode: 'chips',
    ...overrides,
  }

  return renderToStaticMarkup(createElement(PlayerChart, props))
}

function asBarProps(): BarProps {
  expect(captured.bars).toHaveLength(1)
  return captured.bars[0] as unknown as BarProps
}

function asLineProps(): LineProps {
  expect(captured.lines).toHaveLength(1)
  return captured.lines[0] as unknown as LineProps
}

function asCandleElement(value: ReactNode): ReactElement<CandleElementProps> {
  if (!isValidElement<CandleElementProps>(value)) {
    throw new Error('Expected the Bar shape renderer to return a React element')
  }
  expect(value.type).toBe(PlayerCandleShape)
  return value
}

function renderDot(line: LineProps, index: number, payload: HistoryPoint): string {
  const dot = line.dot({ cx: 20, cy: 30, index, payload })
  return renderToStaticMarkup(dot as ReactElement)
}

function renderTooltip(payload: HistoryPoint): string {
  expect(captured.tooltips).toHaveLength(1)
  const tooltip = captured.tooltips[0] as unknown as TooltipProps
  const content = tooltip.content({ active: true, payload: [{ payload }] })
  return renderToStaticMarkup(createElement(Fragment, null, content))
}

beforeEach(resetCaptured)

describe('PlayerChart', () => {
  it('renders the line series by default', () => {
    renderChart()

    expect(captured.bars).toHaveLength(0)
    const line = asLineProps()
    expect(line).toMatchObject({
      type: 'linear',
      dataKey: 'cumulative',
      stroke: '#00ff88',
      strokeWidth: 1.5,
    })
    expect(captured.charts).toHaveLength(1)
    expect(captured.charts[0]).toMatchObject({
      data: [point],
      margin: { top: 18, right: 8, bottom: 12, left: 0 },
    })
  })

  it('renders only a non-animated chips candle series with the low-high range', () => {
    renderChart({ chartType: 'candle' })

    expect(captured.lines).toHaveLength(0)
    const bar = asBarProps()
    expect(bar.dataKey(point)).toEqual([-3000, 4500])
    expect(bar.activeBar).toBe(false)
    expect(bar.isAnimationActive).toBe(false)
    expect(bar.maxBarSize).toBe(24)
  })

  it('uses the CNY candle low-high range', () => {
    renderChart({ chartType: 'candle', mode: 'cny' })

    expect(asBarProps().dataKey(point)).toEqual([-75, 112.5])
  })

  it('delegates missing payload handling to the candle shape guard', () => {
    renderChart({ chartType: 'candle' })

    let candle!: ReactElement<CandleElementProps>
    expect(() => {
      candle = asCandleElement(asBarProps().shape({ index: 0, payload: undefined }))
    }).not.toThrow()
    expect(candle.props.ariaLabel).toBeUndefined()
    expect(renderToStaticMarkup(candle)).toBe('')
  })

  it('passes mode, conflict-free extrema, and activation through the candle shape', () => {
    renderChart({ chartType: 'candle' })

    const single = asCandleElement(asBarProps().shape({ index: 0, payload: point }))
    expect(single.props).toMatchObject({
      ariaLabel: '2026-07-25 session 1 of 1',
      index: 0,
      mode: 'chips',
      payload: point,
      showBest: false,
      showWorst: false,
    })
    single.props.onActivate('s2')
    expect(captured.routerPush).toHaveBeenCalledWith('/sessions/s2')

    resetCaptured()
    const tied = [
      { ...point, date: '2026-07-02', session_id: 's1', chips: 10, cny: 1 },
      { ...point, date: '2026-07-02', session_id: 's2', chips: 10, cny: 1 },
    ] satisfies HistoryPoint[]
    renderChart({ chartType: 'candle', data: tied })
    const tiedBar = asBarProps()
    for (const [index, payload] of tied.entries()) {
      expect(asCandleElement(tiedBar.shape({ index, payload })).props).toMatchObject({
        ariaLabel: `2026-07-02 session ${index + 1} of 2`,
        showBest: false,
        showWorst: false,
      })
    }

    resetCaptured()
    const varied = [
      { ...point, session_id: 's1', chips: 100, cny: 1 },
      { ...point, session_id: 's2', chips: -50, cny: -0.5 },
      { ...point, session_id: 's3', chips: 200, cny: 2 },
    ] satisfies HistoryPoint[]
    renderChart({ chartType: 'candle', data: varied })
    const variedBar = asBarProps()
    expect(asCandleElement(variedBar.shape({ index: 0, payload: varied[0] })).props).toMatchObject({
      labelAnchor: 'start',
      showBest: false,
      showWorst: false,
    })
    expect(asCandleElement(variedBar.shape({ index: 1, payload: varied[1] })).props).toMatchObject({
      labelAnchor: 'middle',
      showBest: false,
      showWorst: true,
    })
    expect(asCandleElement(variedBar.shape({ index: 2, payload: varied[2] })).props).toMatchObject({
      labelAnchor: 'end',
      showBest: true,
      showWorst: false,
    })
  })

  it('suppresses conflicting line extrema and labels distinct extrema', () => {
    renderChart()
    const singleLine = asLineProps()
    expect(renderDot(singleLine, 0, point)).not.toMatch(/BEST|WORST/)

    resetCaptured()
    const tied = [
      { ...point, session_id: 's1', chips: 10, cny: 1 },
      { ...point, session_id: 's2', chips: 10, cny: 1 },
    ] satisfies HistoryPoint[]
    renderChart({ data: tied })
    const tiedLine = asLineProps()
    expect(renderDot(tiedLine, 0, tied[0])).not.toMatch(/BEST|WORST/)
    expect(renderDot(tiedLine, 1, tied[1])).not.toMatch(/BEST|WORST/)

    resetCaptured()
    const varied = [
      { ...point, session_id: 's1', chips: 100, cny: 1 },
      { ...point, session_id: 's2', chips: -50, cny: -0.5 },
      { ...point, session_id: 's3', chips: 200, cny: 2 },
    ] satisfies HistoryPoint[]
    renderChart({ data: varied })
    const variedLine = asLineProps()
    expect(renderDot(variedLine, 0, varied[0])).not.toMatch(/BEST|WORST/)
    expect(renderDot(variedLine, 1, varied[1])).toContain('WORST')
    expect(renderDot(variedLine, 1, varied[1])).not.toContain('BEST')
    expect(renderDot(variedLine, 2, varied[2])).toContain('BEST')
    expect(renderDot(variedLine, 2, varied[2])).not.toContain('WORST')
  })

  it('maps session ids, including same-day sessions, back to axis dates', () => {
    const data = [
      point,
      { ...point, session_id: 's2' },
      { ...point, session_id: 's3', date: '2026-07-26' },
    ] satisfies HistoryPoint[]
    renderChart({ data })

    expect(captured.xAxes).toHaveLength(1)
    const xAxis = captured.xAxes[0] as unknown as XAxisProps
    expect(xAxis.dataKey).toBe('session_id')
    expect(xAxis.interval).toBe('preserveStartEnd')
    expect(xAxis.tickFormatter('s1')).toBe('2026-07-25')
    expect(xAxis.tickFormatter('s2')).toBe('2026-07-25')
    expect(xAxis.tickFormatter('s3')).toBe('2026-07-26')
  })

  it('shows settlement details in the tooltip', () => {
    renderChart()

    const html = renderTooltip(point)
    expect(html).toContain('2026-07-25')
    expect(html).toContain('buy-ins: 3× · 6,000 chips')
    expect(html).toContain('final: 7,500 chips')
    expect(html).toContain('session:')
    expect(html).toContain('+1,500')
    expect(html).toContain('cumulative: +4,500')
    expect(html).toContain('late-night game')
    expect(html).not.toContain('high:')
  })

  it('shows an em dash for an unsettled final result', () => {
    renderChart()

    expect(renderTooltip({ ...point, final_chips: null })).toContain('final: —')
  })

  it('colors the session result by raw chips even when CNY rounds to zero', () => {
    renderChart({ mode: 'cny' })

    const html = renderTooltip({
      ...point,
      chips: -1,
      cny: 0,
      cumulative_cny: 0,
    })
    expect(html).toContain('session: <span style="color:#ff4444">+¥0</span>')
  })

  it('uses gray for a truly flat session result', () => {
    renderChart({ mode: 'cny' })

    const html = renderTooltip({
      ...point,
      chips: 0,
      cny: 0,
      cumulative_cny: 0,
    })
    expect(html).toContain('session: <span style="color:#888888">+¥0</span>')
  })
})
