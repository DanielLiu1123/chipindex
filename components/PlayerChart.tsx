'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface Point { date: string; cumulative: number }

export default function PlayerChart({ data, positive }: { data: Point[]; positive: boolean }) {
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
          formatter={(v) => [typeof v === 'number' && v > 0 ? `+${v}` : v, 'cumulative']}
        />
        <Line
          type="linear"
          dataKey="cumulative"
          stroke={positive ? '#00ff88' : '#ff4444'}
          strokeWidth={1.5}
          dot={{ r: 3, fill: positive ? '#00ff88' : '#ff4444', strokeWidth: 0 }}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
