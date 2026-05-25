'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface Point { date: string; cumulative_cny: number; cumulative: number }

export default function PlayerChart({ data, positive, mode }: { data: Point[]; positive: boolean; mode: 'chips' | 'cny' }) {
  const dataKey = mode === 'cny' ? 'cumulative_cny' : 'cumulative'
  const color = positive ? '#00ff88' : '#ff4444'

  return (
    <ResponsiveContainer width="100%" height={200}>
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
          contentStyle={{
            background: '#111111',
            border: '1px solid #222222',
            borderRadius: 0,
            fontFamily: 'JetBrains Mono',
            fontSize: 12,
            color: '#ffffff',
          }}
          formatter={(v) => {
            const n = Number(v)
            if (mode === 'cny') {
              return [n >= 0 ? `¥${n.toLocaleString()}` : `-¥${Math.abs(n).toLocaleString()}`, 'cumulative CNY']
            }
            return [n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString(), 'cumulative chips']
          }}
        />
        <Line
          type="linear"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={1.5}
          dot={{ r: 3, fill: color, strokeWidth: 0 }}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
