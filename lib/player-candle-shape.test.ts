import { createElement, isValidElement } from 'react'
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

interface TestKeyboardEvent {
  key: string
  preventDefault: () => void
  stopPropagation: () => void
}

interface CandleRootProps {
  onClick: () => void
  onKeyDown: (event: TestKeyboardEvent) => void
}

function getRootProps(overrides: Record<string, unknown> = {}): CandleRootProps {
  const element = PlayerCandleShape({ ...baseProps, ...overrides } as never)
  if (!isValidElement<CandleRootProps>(element)) {
    throw new Error('Expected PlayerCandleShape to return a React element')
  }
  expect(element.type).toBe('g')
  return element.props
}

describe('PlayerCandleShape', () => {
  it('renders an accessible solid green rising candle and BEST label', () => {
    const html = render()

    expect(html).toContain('role="button"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('aria-label="2026-07-25 session"')
    expect(html).toContain('cursor:pointer')
    expect(html).toContain('pointer-events="all"')
    expect(html).toContain('#00ff88')
    expect(html).not.toContain('fill-opacity')
    expect(html).toContain('BEST')
    expect(html).not.toContain('WORST')
  })

  it('uses an explicit accessible label when supplied', () => {
    const html = render({ ariaLabel: '2026-07-25 session 1 of 2' })

    expect(html).toContain('aria-label="2026-07-25 session 1 of 2"')
    expect(html).not.toContain('aria-label="2026-07-25 session"')
  })

  it('draws the wick only outside the candle body', () => {
    const html = render()

    expect(html).toContain('<line x1="20" x2="20" y1="40" y2="120"')
    expect(html).not.toContain('<line x1="20" x2="20" y1="20" y2="120"')
  })

  it('starts the lower wick below a one-pixel candle body', () => {
    const html = render({
      payload: {
        ...payload,
        chips_candle: { low: 0, high: 100, open: 50, close: 50.5 },
      },
    })

    expect(html).toContain('<rect x="14.5" y="69.5" width="11" height="1"')
    expect(html).toContain('<line x1="20" x2="20" y1="20" y2="69.5"')
    expect(html).toContain('<line x1="20" x2="20" y1="70.5" y2="120"')
  })

  it('renders nothing when the Recharts payload is missing', () => {
    expect(render({ payload: undefined })).toBe('')
  })

  it('activates its session exactly once on click', () => {
    const onActivate = vi.fn()
    const rootProps = getRootProps({ onActivate })

    rootProps.onClick()

    expect(onActivate).toHaveBeenCalledTimes(1)
    expect(onActivate).toHaveBeenCalledWith('s1')
  })

  it.each([
    { name: 'Enter', key: 'Enter' },
    { name: 'Space', key: ' ' },
  ])('handles $name as an activation key', ({ key }) => {
    const onActivate = vi.fn()
    const event = {
      key,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }
    const rootProps = getRootProps({ onActivate })

    rootProps.onKeyDown(event)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(event.stopPropagation).toHaveBeenCalledTimes(1)
    expect(onActivate).toHaveBeenCalledTimes(1)
    expect(onActivate).toHaveBeenCalledWith('s1')
  })

  it.each([
    { name: 'ArrowRight', key: 'ArrowRight' },
    { name: 'Escape', key: 'Escape' },
  ])('ignores the non-activation key $name', ({ key }) => {
    const onActivate = vi.fn()
    const event = {
      key,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    }
    const rootProps = getRootProps({ onActivate })

    rootProps.onKeyDown(event)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(event.stopPropagation).not.toHaveBeenCalled()
    expect(onActivate).not.toHaveBeenCalled()
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
    expect(html).toContain('<line x1="14.5" x2="25.5" y1="40" y2="40" stroke="#ff4444"')
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
      label: 'BEST',
      labelAnchor: 'start',
      overrides: { showBest: true, showWorst: false },
    },
    {
      label: 'WORST',
      labelAnchor: 'end',
      overrides: { showBest: false, showWorst: true },
    },
  ] as const)('uses the supplied anchor for the $label label', ({ label, labelAnchor, overrides }) => {
    const html = render({ ...overrides, labelAnchor })

    expect(html).toMatch(new RegExp(`<text[^>]*text-anchor="${labelAnchor}"[^>]*>${label}</text>`))
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

  it.each([
    {
      name: 'a truthy malformed payload',
      overrides: { payload: {} },
    },
    {
      name: 'a non-string date',
      overrides: { payload: { ...payload, date: null } },
    },
    {
      name: 'an empty session id',
      overrides: { payload: { ...payload, session_id: '' } },
    },
    {
      name: 'non-finite raw chips',
      overrides: { payload: { ...payload, chips: Number.NaN } },
    },
    {
      name: 'a missing chips candle in chips mode',
      overrides: { payload: { ...payload, chips_candle: undefined } },
    },
    {
      name: 'a missing CNY candle in CNY mode',
      overrides: {
        mode: 'cny',
        payload: { ...payload, cny_candle: undefined },
      },
    },
  ])('renders nothing without throwing for $name', ({ overrides }) => {
    let html: string | undefined

    expect(() => {
      html = render(overrides)
    }).not.toThrow()
    expect(html).toBe('')
  })
})
