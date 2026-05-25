'use client'

import { useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface Point {
  date: string
  session_id: string
  cumulative_cny: number
  cumulative: number
  cny: number
  chips: number
  description: string | null
}

export default function PlayerChart({ data, positive, mode }: { data: Point[]; positive: boolean; mode: 'chips' | 'cny' }) {
  const router = useRouter()
  const dataKey = mode === 'cny' ? 'cumulative_cny' : 'cumulative'
  const sessionKey = mode === 'cny' ? 'cny' : 'chips'
  const color = positive ? '#00ff88' : '#ff4444'

  const bestIdx = useMemo(() => data.reduce((bi, p, i) => (p[sessionKey] > data[bi][sessionKey] ? i : bi), 0), [data, sessionKey])
  const worstIdx = useMemo(() => data.reduce((wi, p, i) => (p[sessionKey] < data[wi][sessionKey] ? i : wi), 0), [data, sessionKey])

  const CustomDot = useCallback((props: any) => {
    const { cx, cy, index, payload } = props
    const isBest = index === bestIdx
    const isWorst = index === worstIdx
    const r = isBest || isWorst ? 5 : 3
    const fill = isBest ? '#00ff88' : isWorst ? '#ff4444' : color

    return (
      <g
        key={payload.session_id}
        style={{ cursor: 'pointer' }}
        onClick={() => router.push(`/sessions/${payload.session_id}`)}
      >
        {(isBest || isWorst) && (
          <circle cx={cx} cy={cy} r={r + 4} fill={fill} opacity={0.2} />
        )}
        <circle cx={cx} cy={cy} r={r} fill={fill} />
        {isBest && (
          <text x={cx} y={cy - 12} textAnchor="middle" fill="#00ff88" fontSize={9} fontFamily="JetBrains Mono">
            BEST
          </text>
        )}
        {isWorst && (
          <text x={cx} y={cy - 12} textAnchor="middle" fill="#ff4444" fontSize={9} fontFamily="JetBrains Mono">
            WORST
          </text>
        )}
      </g>
    )
  }, [bestIdx, worstIdx, color, router])

  const CustomActiveDot = useCallback((props: any) => {
    const { cx, cy, payload } = props
    return (
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={color}
        style={{ cursor: 'pointer' }}
        onClick={() => router.push(`/sessions/${payload.session_id}`)}
      />
    )
  }, [color, router])

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <XAxis
          dataKey="date"
          tick={{ fill: '#666666', fontSize: 10, fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#666666', fontSize: 10, fontFamily: 'JetBrains Mono' }}
          axisLine={false}
          tickLine={false}
          width={50}
          tickFormatter={v => mode === 'cny'
            ? (v >= 0 ? `¥${v.toLocaleString()}` : `-¥${Math.abs(v).toLocaleString()}`)
            : (v > 0 ? `+${v.toLocaleString()}` : v.toLocaleString())
          }
        />
        <ReferenceLine y={0} stroke="#333333" strokeDasharray="3 3" />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const p: Point = payload[0].payload
            const val = mode === 'cny' ? p.cny : p.chips
            const cumVal = mode === 'cny' ? p.cumulative_cny : p.cumulative
            const fmtVal = (n: number, cny: boolean) =>
              cny
                ? (n >= 0 ? `+¥${n.toLocaleString()}` : `-¥${Math.abs(n).toLocaleString()}`)
                : (n >= 0 ? `+${n.toLocaleString()}` : `${n.toLocaleString()}`)
            return (
              <div style={{ background: '#111111', border: '1px solid #222222', fontFamily: 'JetBrains Mono', fontSize: 11, color: '#ffffff', padding: '8px 12px', lineHeight: 1.8 }}>
                <div style={{ color: '#666666', marginBottom: 4 }}>{p.date}</div>
                <div>session: <span style={{ color: val >= 0 ? '#00ff88' : '#ff4444' }}>{fmtVal(val, mode === 'cny')}</span></div>
                <div style={{ color: '#666666' }}>cumulative: {fmtVal(cumVal, mode === 'cny')}</div>
                {p.description && <div style={{ color: '#888888', marginTop: 4, maxWidth: 200 }}>{p.description}</div>}
              </div>
            )
          }}
        />
        <Line
          type="linear"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.5}
          dot={CustomDot}
          activeDot={CustomActiveDot}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
