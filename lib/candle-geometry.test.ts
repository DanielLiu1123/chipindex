import { describe, expect, it } from 'vitest'
import {
  candleDirection,
  isActivationKey,
  projectCandleGeometry,
  type CandleBounds,
} from './candle-geometry'
import type { CandlePoint } from './stats'

const bounds: CandleBounds = { x: 10, y: 20, width: 20, height: 100 }

describe('candleDirection', () => {
  it('uses only the raw net chip sign', () => {
    expect(candleDirection(1)).toBe('up')
    expect(candleDirection(-1)).toBe('down')
    expect(candleDirection(0)).toBe('flat')
  })
})

describe('isActivationKey', () => {
  it('accepts only Enter and a single space', () => {
    expect(isActivationKey('Enter')).toBe(true)
    expect(isActivationKey(' ')).toBe(true)
    expect(isActivationKey('ArrowRight')).toBe(false)
    expect(isActivationKey('Spacebar')).toBe(false)
    expect(isActivationKey('  ')).toBe(false)
  })
})

describe('projectCandleGeometry', () => {
  it('projects a rising candle into the supplied bounds', () => {
    expect(projectCandleGeometry(bounds, { low: 0, high: 100, open: 25, close: 75 })).toEqual({
      centerX: 20,
      wickTop: 20,
      wickBottom: 120,
      openY: 95,
      closeY: 45,
      bodyLeft: 14.5,
      bodyWidth: 11,
      hitX: 12,
      hitY: 20,
      hitWidth: 16,
      hitHeight: 100,
      isDoji: false,
    })
  })

  it('preserves open and close positions for a falling candle', () => {
    expect(projectCandleGeometry(bounds, { low: 0, high: 100, open: 75, close: 25 })).toMatchObject({
      openY: 45,
      closeY: 95,
      bodyLeft: 14.5,
      bodyWidth: 11,
      isDoji: false,
    })
  })

  it('marks equal open and close values as a doji in a non-zero range', () => {
    expect(projectCandleGeometry(bounds, { low: 0, high: 100, open: 50, close: 50 })).toMatchObject({
      openY: 70,
      closeY: 70,
      isDoji: true,
    })
  })

  it('keeps sub-pixel height coordinates finite', () => {
    const geometry = projectCandleGeometry(
      { x: 10, y: 20, width: 20, height: 0.2 },
      { low: 0, high: 100, open: 25, close: 75 },
    )

    expect(geometry).not.toBeNull()
    if (geometry === null) throw new Error('Expected valid candle geometry')

    const numericValues = Object.values(geometry).filter(value => typeof value === 'number')
    expect(numericValues.every(Number.isFinite)).toBe(true)
    expect(geometry.wickBottom).toBeCloseTo(20.2)
  })

  it('projects an all-zero candle at the bounds origin', () => {
    const geometry = projectCandleGeometry(
      { x: 10, y: 50, width: 20, height: 0 },
      { low: 0, high: 0, open: 0, close: 0 },
    )

    expect(geometry).toMatchObject({
      wickTop: 50,
      wickBottom: 50,
      openY: 50,
      closeY: 50,
      hitY: 38,
      hitHeight: 24,
      isDoji: true,
    })
  })

  it('caps body and hit widths to extremely narrow bounds', () => {
    const geometry = projectCandleGeometry(
      { x: 10, y: 20, width: 0.4, height: 100 },
      { low: 0, high: 100, open: 25, close: 75 },
    )

    expect(geometry).not.toBeNull()
    expect(geometry?.bodyWidth).toBeLessThanOrEqual(0.4)
    expect(geometry?.hitWidth).toBeLessThanOrEqual(0.4)
  })

  it.each<{
    name: string
    testBounds: CandleBounds
    candle: CandlePoint
  }>([
    {
      name: 'inverted OHLC range',
      testBounds: bounds,
      candle: { low: 5, high: 4, open: 5, close: 4 },
    },
    {
      name: 'non-finite OHLC value',
      testBounds: bounds,
      candle: { low: 0, high: Number.NaN, open: 0, close: 0 },
    },
    {
      name: 'non-finite bounds value',
      testBounds: { ...bounds, x: Number.POSITIVE_INFINITY },
      candle: { low: 0, high: 100, open: 25, close: 75 },
    },
    {
      name: 'zero width',
      testBounds: { ...bounds, width: 0 },
      candle: { low: 0, high: 100, open: 25, close: 75 },
    },
    {
      name: 'negative width',
      testBounds: { ...bounds, width: -1 },
      candle: { low: 0, high: 100, open: 25, close: 75 },
    },
    {
      name: 'negative height',
      testBounds: { ...bounds, height: -1 },
      candle: { low: 0, high: 100, open: 25, close: 75 },
    },
    {
      name: 'open below low',
      testBounds: bounds,
      candle: { low: 0, high: 100, open: -1, close: 75 },
    },
    {
      name: 'close above high',
      testBounds: bounds,
      candle: { low: 0, high: 100, open: 25, close: 101 },
    },
  ])('returns null for $name', ({ testBounds, candle }) => {
    expect(projectCandleGeometry(testBounds, candle)).toBeNull()
  })
})
