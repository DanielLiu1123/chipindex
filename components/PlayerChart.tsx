'use client'

import { createElement, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bar,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from 'recharts'
import PlayerCandleShape from '@/components/PlayerCandleShape'
import type { HistoryPoint } from '@/lib/stats'
import { formatAmount } from '@/lib/format'

type ChartType = 'line' | 'candle'

export default function PlayerChart({
  data,
  positive,
  mode,
  chartType = 'line',
}: {
  data: HistoryPoint[]
  positive: boolean
  mode: 'chips' | 'cny'
  chartType?: ChartType
}) {
  const router = useRouter()
  const dataKey = mode === 'cny' ? 'cumulative_cny' : 'cumulative'
  const sessionKey = mode === 'cny' ? 'cny' : 'chips'
  const color = positive ? '#00ff88' : '#ff4444'

  const bestIdx = useMemo(() => data.reduce((bi, p, i) => (p[sessionKey] > data[bi][sessionKey] ? i : bi), 0), [data, sessionKey])
  const worstIdx = useMemo(() => data.reduce((wi, p, i) => (p[sessionKey] < data[wi][sessionKey] ? i : wi), 0), [data, sessionKey])
  const showExtrema = data.length > 1 && bestIdx !== worstIdx
  const dateBySessionId = useMemo(
    () => new Map(data.map(point => [point.session_id, point.date])),
    [data],
  )
  const activateSession = useCallback((sessionId: string) => {
    router.push(`/sessions/${sessionId}`)
  }, [router])

  const CustomDot = useCallback((props: any) => {
    const { cx, cy, index, payload } = props
    const isBest = showExtrema && index === bestIdx
    const isWorst = showExtrema && index === worstIdx
    const r = isBest || isWorst ? 5 : 3
    const fill = isBest ? '#00ff88' : isWorst ? '#ff4444' : color

    return createElement(
      'g',
      {
        key: payload.session_id,
        style: { cursor: 'pointer' },
        onClick: () => activateSession(payload.session_id),
      },
      (isBest || isWorst)
        ? createElement('circle', { cx, cy, r: r + 4, fill, opacity: 0.2 })
        : null,
      createElement('circle', { cx, cy, r, fill }),
      isBest
        ? createElement('text', {
            x: cx,
            y: cy - 12,
            textAnchor: 'middle',
            fill: '#00ff88',
            fontSize: 9,
            fontFamily: 'JetBrains Mono',
          }, 'BEST')
        : null,
      isWorst
        ? createElement('text', {
            x: cx,
            y: cy - 12,
            textAnchor: 'middle',
            fill: '#ff4444',
            fontSize: 9,
            fontFamily: 'JetBrains Mono',
          }, 'WORST')
        : null,
    )
  }, [activateSession, bestIdx, color, showExtrema, worstIdx])

  const CustomActiveDot = useCallback((props: any) => {
    const { cx, cy, payload } = props
    return createElement('circle', {
      cx,
      cy,
      r: 5,
      fill: color,
      style: { cursor: 'pointer' },
      onClick: () => activateSession(payload.session_id),
    })
  }, [activateSession, color])

  const candleRange = useCallback((value: unknown): [number, number] => {
    const point = value as HistoryPoint
    const candle = mode === 'cny' ? point.cny_candle : point.chips_candle
    return [candle.low, candle.high]
  }, [mode])

  const renderCandle = useCallback((props: BarShapeProps) => createElement(PlayerCandleShape, {
    ...props,
    labelAnchor: props.index === 0
      ? 'start'
      : props.index === data.length - 1 ? 'end' : 'middle',
    mode,
    showBest: showExtrema && props.index === bestIdx,
    showWorst: showExtrema && props.index === worstIdx,
    onActivate: activateSession,
  }), [activateSession, bestIdx, data.length, mode, showExtrema, worstIdx])

  return createElement(
    ResponsiveContainer,
    {
      width: '100%',
      height: 220,
      children: createElement(
        ComposedChart,
        { data, margin: { top: 18, right: 8, bottom: 12, left: 0 } },
        createElement(XAxis, {
          dataKey: 'session_id',
          interval: 'preserveStartEnd',
          tickFormatter: (sessionId: string) => dateBySessionId.get(sessionId) ?? sessionId,
          tick: { fill: '#666666', fontSize: 10, fontFamily: 'JetBrains Mono' },
          axisLine: false,
          tickLine: false,
        }),
        createElement(YAxis, {
          tick: { fill: '#666666', fontSize: 10, fontFamily: 'JetBrains Mono' },
          axisLine: false,
          tickLine: false,
          width: 50,
          tickFormatter: (v: number) => mode === 'cny'
            ? (v >= 0 ? `¥${formatAmount(v)}` : `-¥${formatAmount(Math.abs(v))}`)
            : (v > 0 ? `+${v.toLocaleString()}` : v.toLocaleString()),
        }),
        createElement(ReferenceLine, { y: 0, stroke: '#333333', strokeDasharray: '3 3' }),
        createElement(Tooltip, {
          content: ({ active, payload }: any) => {
            if (!active || !payload?.length) return null
            const p: HistoryPoint = payload[0].payload
            const val = mode === 'cny' ? p.cny : p.chips
            const cumVal = mode === 'cny' ? p.cumulative_cny : p.cumulative
            const sessionColor = p.chips > 0 ? '#00ff88' : p.chips < 0 ? '#ff4444' : '#888888'
            const fmtVal = (n: number, cny: boolean) =>
              cny
                ? (n >= 0 ? `+¥${formatAmount(n)}` : `-¥${formatAmount(Math.abs(n))}`)
                : (n >= 0 ? `+${n.toLocaleString()}` : `${n.toLocaleString()}`)
            return createElement(
              'div',
              { style: { background: '#111111', border: '1px solid #222222', fontFamily: 'JetBrains Mono', fontSize: 11, color: '#ffffff', padding: '8px 12px', lineHeight: 1.8 } },
              createElement('div', { style: { color: '#666666', marginBottom: 4 } }, p.date),
              createElement('div', null, `buy-ins: ${p.buy_in_count}× · ${p.total_buyin.toLocaleString()} chips`),
              createElement('div', null, 'final: ', p.final_chips === null ? '—' : `${p.final_chips.toLocaleString()} chips`),
              createElement(
                'div',
                null,
                'session: ',
                createElement('span', { style: { color: sessionColor } }, fmtVal(val, mode === 'cny')),
              ),
              createElement('div', { style: { color: '#666666' } }, 'cumulative: ', fmtVal(cumVal, mode === 'cny')),
              p.description
                ? createElement('div', { style: { color: '#888888', marginTop: 4, maxWidth: 200 } }, p.description)
                : null,
            )
          },
        }),
        chartType === 'line'
          ? createElement(Line, {
              type: 'linear',
              dataKey,
              stroke: color,
              strokeWidth: 1.5,
              dot: CustomDot,
              activeDot: CustomActiveDot,
            })
          : createElement(Bar, {
              dataKey: candleRange,
              shape: renderCandle,
              activeBar: false,
              isAnimationActive: false,
              maxBarSize: 24,
            }),
      ),
    },
  )
}
