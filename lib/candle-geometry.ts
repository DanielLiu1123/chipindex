import type { CandlePoint } from './stats'

export type CandleDirection = 'up' | 'down' | 'flat'

export interface CandleBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface CandleGeometry {
  centerX: number
  wickTop: number
  wickBottom: number
  openY: number
  closeY: number
  bodyLeft: number
  bodyWidth: number
  hitX: number
  hitY: number
  hitWidth: number
  hitHeight: number
  isDoji: boolean
}

export function candleDirection(netChips: number): CandleDirection {
  if (netChips > 0) return 'up'
  if (netChips < 0) return 'down'
  return 'flat'
}

export function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' '
}

export function projectCandleGeometry(
  bounds: CandleBounds,
  candle: CandlePoint,
): CandleGeometry | null {
  const values = [
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    candle.low,
    candle.high,
    candle.open,
    candle.close,
  ]

  if (!values.every(Number.isFinite) || bounds.width <= 0 || bounds.height < 0) return null
  if (
    candle.low > Math.min(candle.open, candle.close)
    || candle.high < Math.max(candle.open, candle.close)
  ) return null

  const candleSpan = candle.high - candle.low
  if (candle.high !== candle.low && !Number.isFinite(candleSpan)) return null

  const boundsRight = bounds.x + bounds.width
  const boundsBottom = bounds.y + bounds.height
  if (!Number.isFinite(boundsRight) || !Number.isFinite(boundsBottom)) return null

  const projectY = (value: number): number => candle.high === candle.low
    ? bounds.y
    : bounds.y + ((candle.high - value) / candleSpan) * bounds.height

  const centerX = bounds.x + bounds.width / 2
  const bodyWidth = Math.min(bounds.width, Math.max(0.5, bounds.width * 0.55))
  const hitWidth = Math.min(bounds.width, Math.max(bodyWidth, 24))
  const hitHeight = Math.max(bounds.height, 24)

  const geometry: CandleGeometry = {
    centerX,
    wickTop: projectY(candle.high),
    wickBottom: projectY(candle.low),
    openY: projectY(candle.open),
    closeY: projectY(candle.close),
    bodyLeft: centerX - bodyWidth / 2,
    bodyWidth,
    hitX: centerX - hitWidth / 2,
    hitY: bounds.y + (bounds.height - hitHeight) / 2,
    hitWidth,
    hitHeight,
    isDoji: candle.open === candle.close,
  }

  const numericValues = [
    geometry.centerX,
    geometry.wickTop,
    geometry.wickBottom,
    geometry.openY,
    geometry.closeY,
    geometry.bodyLeft,
    geometry.bodyWidth,
    geometry.hitX,
    geometry.hitY,
    geometry.hitWidth,
    geometry.hitHeight,
  ]

  return numericValues.every(Number.isFinite) ? geometry : null
}
