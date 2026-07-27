import { createElement } from 'react'
import type { KeyboardEvent } from 'react'
import type { BarShapeProps } from 'recharts'
import {
  candleDirection,
  isActivationKey,
  projectCandleGeometry,
} from '@/lib/candle-geometry'
import type { HistoryPoint } from '@/lib/stats'

type Mode = 'chips' | 'cny'

interface PlayerCandleShapeProps extends BarShapeProps {
  ariaLabel?: string
  labelAnchor?: 'start' | 'middle' | 'end'
  mode: Mode
  showBest: boolean
  showWorst: boolean
  onActivate: (sessionId: string) => void
}

const COLORS = {
  up: '#00ff88',
  down: '#ff4444',
  flat: '#888888',
} as const

interface ShapePayload {
  date: string
  session_id: string
  chips: number
  candle: HistoryPoint['chips_candle']
}

function readShapePayload(value: unknown, mode: Mode): ShapePayload | null {
  if (typeof value !== 'object' || value === null) return null

  const candidate = value as Record<string, unknown>
  if (
    typeof candidate.date !== 'string'
    || typeof candidate.session_id !== 'string'
    || candidate.session_id.length === 0
    || typeof candidate.chips !== 'number'
    || !Number.isFinite(candidate.chips)
  ) return null

  const candle = candidate[mode === 'cny' ? 'cny_candle' : 'chips_candle']
  if (typeof candle !== 'object' || candle === null) return null

  return {
    date: candidate.date,
    session_id: candidate.session_id,
    chips: candidate.chips,
    candle: candle as HistoryPoint['chips_candle'],
  }
}

export default function PlayerCandleShape(props: PlayerCandleShapeProps) {
  const payload = readShapePayload(props.payload, props.mode)
  if (!payload) return null

  const candle = payload.candle
  const geometry = projectCandleGeometry({
    x: Number(props.x),
    y: Number(props.y),
    width: Number(props.width),
    height: Number(props.height),
  }, candle)
  if (!geometry) return null

  const color = COLORS[candleDirection(payload.chips)]
  const labelAnchor = props.labelAnchor ?? 'middle'
  const bodyTop = Math.min(geometry.openY, geometry.closeY)
  const bodyHeight = Math.max(1, Math.abs(geometry.openY - geometry.closeY))
  const activate = () => props.onActivate(payload.session_id)
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (!isActivationKey(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    activate()
  }

  const body = geometry.isDoji
    ? createElement('line', {
        x1: geometry.bodyLeft,
        x2: geometry.bodyLeft + geometry.bodyWidth,
        y1: geometry.openY,
        y2: geometry.openY,
        stroke: color,
        strokeWidth: 2,
      })
    : createElement('rect', {
        x: geometry.bodyLeft,
        y: bodyTop,
        width: geometry.bodyWidth,
        height: bodyHeight,
        fill: color,
        fillOpacity: 0.22,
        stroke: color,
        strokeWidth: 1.5,
      })

  const bestLabel = props.showBest
    ? createElement('text', {
        x: geometry.centerX,
        y: bodyTop - 10,
        textAnchor: labelAnchor,
        fill: '#00ff88',
        fontSize: 9,
        fontFamily: 'JetBrains Mono',
      }, 'BEST')
    : null

  const worstLabel = props.showWorst
    ? createElement('text', {
        x: geometry.centerX,
        y: bodyTop + bodyHeight + 14,
        textAnchor: labelAnchor,
        fill: '#ff4444',
        fontSize: 9,
        fontFamily: 'JetBrains Mono',
      }, 'WORST')
    : null

  return createElement(
    'g',
    {
      role: 'button',
      tabIndex: 0,
      'aria-label': props.ariaLabel ?? `${payload.date} session`,
      onClick: activate,
      onKeyDown,
      style: { cursor: 'pointer' },
    },
    createElement('rect', {
      x: geometry.hitX,
      y: geometry.hitY,
      width: geometry.hitWidth,
      height: geometry.hitHeight,
      fill: 'transparent',
      pointerEvents: 'all',
    }),
    createElement('line', {
      x1: geometry.centerX,
      x2: geometry.centerX,
      y1: geometry.wickTop,
      y2: geometry.wickBottom,
      stroke: color,
      strokeWidth: props.isActive ? 2 : 1.5,
    }),
    body,
    bestLabel,
    worstLabel,
  )
}
