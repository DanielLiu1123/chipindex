import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import PlayerCandleShape from '@/components/PlayerCandleShape'
import type { HistoryPoint } from './stats'

const payload: HistoryPoint = {
  date: '2026-07-25',
  session_id: 's1',
  chips: 1500,
  cumulative: 4500,
  cny: 37.5,
  cumulative_cny: 112.5,
  description: null,
  buy_in_count: 3,
  total_buyin: 6000,
  final_chips: 7500,
  chips_candle: { open: 3000, high: 4500, low: -3000, close: 4500 },
  cny_candle: { open: 75, high: 112.5, low: -75, close: 112.5 },
}

const baseProps = {
  x: 10,
  y: 20,
  width: 20,
  height: 100,
  index: 0,
  isActive: false,
  payload,
  mode: 'chips' as const,
  showBest: true,
  showWorst: false,
  onActivate: vi.fn(),
}

function render(overrides: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(PlayerCandleShape, { ...baseProps, ...overrides } as never),
  )
}

describe('PlayerCandleShape', () => {
  it('renders an accessible green rising candle and BEST label', () => {
    const html = render()

    expect(html).toContain('role="button"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('aria-label="2026-07-25 session"')
    expect(html).toContain('cursor:pointer')
    expect(html).toContain('pointer-events="all"')
    expect(html).toContain('#00ff88')
    expect(html).toContain('fill-opacity="0.22"')
    expect(html).toContain('BEST')
    expect(html).not.toContain('WORST')
  })

  it('renders nothing when the Recharts payload is missing', () => {
    expect(render({ payload: undefined })).toBe('')
  })

  it('uses raw negative chips for a red CNY doji', () => {
    const negativePayload: HistoryPoint = {
      ...payload,
      chips: -1,
      cny_candle: { open: 75, high: 112.5, low: -75, close: 75 },
    }

    const html = render({
      payload: negativePayload,
      mode: 'cny',
      showBest: false,
    })

    expect(html).toContain('#ff4444')
    expect(html).not.toContain('#00ff88')
    expect(html).not.toContain('fill-opacity="0.22"')
  })

  it('uses gray for a flat raw chip result', () => {
    const html = render({
      payload: { ...payload, chips: 0 },
      showBest: false,
    })

    expect(html).toContain('#888888')
    expect(html).not.toContain('#00ff88')
    expect(html).not.toContain('#ff4444')
  })

  it('renders WORST independently below the candle body', () => {
    const html = render({ showBest: false, showWorst: true })

    expect(html).toContain('y="54"')
    expect(html).toContain('#ff4444')
    expect(html).toContain('WORST')
    expect(html).not.toContain('BEST')
  })

  it.each([
    {
      name: 'a missing x coordinate',
      overrides: { x: undefined },
    },
    {
      name: 'an invalid candle range',
      overrides: {
        payload: {
          ...payload,
          chips_candle: { open: 3000, high: 2000, low: -3000, close: 4500 },
        },
      },
    },
  ])('renders nothing for $name', ({ overrides }) => {
    expect(render(overrides)).toBe('')
  })
})
