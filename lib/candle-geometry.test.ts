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

  it('projects a translated range spanning zero without changing its proportions', () => {
    const geometry = projectCandleGeometry(
      bounds,
      { low: -50, high: 150, open: 0, close: 100 },
    )

    expect(geometry).not.toBeNull()
    if (geometry === null) throw new Error('Expected valid candle geometry')

    expect(geometry).toMatchObject({
      centerX: 20,
      wickTop: 20,
      wickBottom: 120,
      openY: 95,
      closeY: 45,
      bodyLeft: 14.5,
      bodyWidth: 11,
    })
    expect(geometry.wickTop).toBeGreaterThanOrEqual(bounds.y)
    expect(geometry.wickBottom).toBeLessThanOrEqual(bounds.y + bounds.height)
    expect(Math.min(geometry.openY, geometry.closeY)).toBeGreaterThanOrEqual(bounds.y)
    expect(Math.max(geometry.openY, geometry.closeY)).toBeLessThanOrEqual(bounds.y + bounds.height)
    expect(geometry.bodyLeft).toBeGreaterThanOrEqual(bounds.x)
    expect(geometry.bodyLeft + geometry.bodyWidth).toBeLessThanOrEqual(bounds.x + bounds.width)
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

  it('projects a non-zero constant candle to the top of the bounds', () => {
    const geometry = projectCandleGeometry(
      bounds,
      { low: 42, high: 42, open: 42, close: 42 },
    )

    expect(geometry).not.toBeNull()
    if (geometry === null) throw new Error('Expected valid candle geometry')

    const numericValues = Object.values(geometry).filter(value => typeof value === 'number')
    expect(numericValues.every(Number.isFinite)).toBe(true)
    expect(geometry).toMatchObject({
      wickTop: bounds.y,
      wickBottom: bounds.y,
      openY: bounds.y,
      closeY: bounds.y,
      isDoji: true,
    })
  })

  it('caps body and hit widths to extremely narrow bounds', () => {
    const narrowBounds = { x: 10, y: 20, width: 0.4, height: 100 }
    const geometry = projectCandleGeometry(
      narrowBounds,
      { low: 0, high: 100, open: 25, close: 75 },
    )

    expect(geometry).not.toBeNull()
    if (geometry === null) throw new Error('Expected valid candle geometry')

    const categoryRight = narrowBounds.x + narrowBounds.width
    const bodyRight = geometry.bodyLeft + geometry.bodyWidth
    const hitRight = geometry.hitX + geometry.hitWidth

    expect(geometry.bodyWidth).toBeGreaterThan(0)
    expect(geometry.bodyWidth).toBeLessThanOrEqual(narrowBounds.width)
    expect(geometry.hitWidth).toBeGreaterThan(0)
    expect(geometry.hitWidth).toBeLessThanOrEqual(narrowBounds.width)
    expect(geometry.bodyLeft).toBeGreaterThanOrEqual(narrowBounds.x)
    expect(bodyRight).toBeLessThanOrEqual(categoryRight)
    expect(geometry.hitX).toBeGreaterThanOrEqual(narrowBounds.x)
    expect(hitRight).toBeLessThanOrEqual(categoryRight)
    expect(geometry.centerX).toBeCloseTo(narrowBounds.x + narrowBounds.width / 2)
    expect(geometry.bodyLeft + geometry.bodyWidth / 2).toBeCloseTo(geometry.centerX)
    expect(geometry.hitX + geometry.hitWidth / 2).toBeCloseTo(geometry.centerX)
  })

  it.each<{
    name: string
    testBounds: CandleBounds
    candle: CandlePoint
  }>([
    {
      name: 'candle span overflow',
      testBounds: bounds,
      candle: {
        low: -Number.MAX_VALUE,
        high: Number.MAX_VALUE,
        open: 0,
        close: 0,
      },
    },
    {
      name: 'bounds right edge overflow',
      testBounds: {
        x: Number.MAX_VALUE,
        y: 20,
        width: Number.MAX_VALUE,
        height: 100,
      },
      candle: { low: 0, high: 100, open: 25, close: 75 },
    },
    {
      name: 'bounds bottom edge overflow',
      testBounds: {
        x: 10,
        y: Number.MAX_VALUE,
        width: 20,
        height: Number.MAX_VALUE,
      },
      candle: { low: 0, high: 100, open: 25, close: 75 },
    },
  ])('returns null when $name makes derived geometry non-finite', ({ testBounds, candle }) => {
    expect(projectCandleGeometry(testBounds, candle)).toBeNull()
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
