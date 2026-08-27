'use client'

import { createElement, useCallback, useMemo, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bar,
  ComposedChart,
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

export default function PlayerChart({
  groupId,
  data,
  mode,
}: {
  groupId: string
  data: HistoryPoint[]
  mode: 'chips' | 'cny'
}) {
  const router = useRouter()
  const sessionKey = mode === 'cny' ? 'cny' : 'chips'

  const bestIdx = useMemo(() => data.reduce((bi, p, i) => (p[sessionKey] > data[bi][sessionKey] ? i : bi), 0), [data, sessionKey])
  const worstIdx = useMemo(() => data.reduce((wi, p, i) => (p[sessionKey] < data[wi][sessionKey] ? i : wi), 0), [data, sessionKey])
  const showExtrema = data.length > 1 && bestIdx !== worstIdx
  const mobileChartWidth = Math.max(320, data.length * 24 + 80)
  const dateBySessionId = useMemo(
    () => new Map(data.map(point => [point.session_id, point.date])),
    [data],
  )
  const activateSession = useCallback((sessionId: string) => {
    router.push(`/groups/${groupId}/sessions/${sessionId}`)
  }, [groupId, router])

  const candleRange = useCallback((value: unknown): [number, number] => {
    const point = value as HistoryPoint
    const candle = mode === 'cny' ? point.cny_candle : point.chips_candle
    return [candle.low, candle.high]
  }, [mode])

  const renderCandle = useCallback((props: BarShapeProps) => {
    const payload = props.payload as HistoryPoint | undefined
    const index = Number(props.index)

    return createElement(PlayerCandleShape, {
      ...props,
      ariaLabel: payload
        ? `${payload.date} session ${index + 1} of ${data.length}`
        : undefined,
      labelAnchor: index === 0
        ? 'start'
        : index === data.length - 1 ? 'end' : 'middle',
      mode,
      showBest: showExtrema && index === bestIdx,
      showWorst: showExtrema && index === worstIdx,
      onActivate: activateSession,
    })
  }, [activateSession, bestIdx, data.length, mode, showExtrema, worstIdx])

  const chart = createElement(
    ResponsiveContainer,
    {
      width: '100%',
      height: '100%',
      children: createElement(
        ComposedChart,
        { data, margin: { top: 18, right: 8, bottom: 12, left: 0 } },
        createElement(XAxis, {
          dataKey: 'session_id',
          interval: 'preserveStartEnd',
          tickFormatter: (sessionId: string) => dateBySessionId.get(sessionId) ?? sessionId,
          tick: { fill: '#888888', fontSize: 10, fontFamily: 'JetBrains Mono' },
          axisLine: false,
          tickLine: false,
        }),
        createElement(YAxis, {
          tick: { fill: '#888888', fontSize: 10, fontFamily: 'JetBrains Mono' },
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
              createElement('div', { style: { color: '#888888', marginBottom: 4 } }, p.date),
              createElement('div', null, `buy-ins: ${p.buy_in_count}× · ${p.total_buyin.toLocaleString()} chips`),
              createElement('div', null, 'final: ', p.final_chips === null ? '—' : `${p.final_chips.toLocaleString()} chips`),
              createElement(
                'div',
                null,
                'session: ',
                createElement('span', { style: { color: sessionColor } }, fmtVal(val, mode === 'cny')),
              ),
              createElement('div', { style: { color: '#888888' } }, 'cumulative: ', fmtVal(cumVal, mode === 'cny')),
              p.description
                ? createElement('div', { style: { color: '#888888', marginTop: 4, maxWidth: 200 } }, p.description)
                : null,
            )
          },
        }),
        createElement(Bar, {
          dataKey: candleRange,
          shape: renderCandle,
          activeBar: false,
          isAnimationActive: false,
          maxBarSize: 24,
        }),
      ),
    },
  )

  return createElement(
    'div',
    null,
    data.length > 10
      ? createElement('p', {
          className: 'mb-2 text-[10px] tracking-widest text-muted sm:hidden',
        }, 'SWIPE TO VIEW ALL SESSIONS')
      : null,
    createElement(
      'div',
      {
        role: 'region',
        tabIndex: 0,
        'aria-label': 'Scrollable session chart',
        className: 'overflow-x-auto overscroll-x-contain pb-2',
      },
      createElement('div', {
        className: 'h-[220px] min-w-full max-sm:w-[var(--mobile-chart-width)]',
        style: { '--mobile-chart-width': `${mobileChartWidth}px` } as CSSProperties,
      }, chart),
    ),
  )
}
