'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'

const COLORS = [
  '#00ff88', '#6bcfff', '#ffd93d', '#ff6b6b',
  '#c77dff', '#ff8c42', '#ff77ab', '#a8dadc',
]

interface ChartPoint { date: string; [player: string]: string | number }

export default function LeaderboardChart({ data, players }: { data: ChartPoint[]; players: string[] }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
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
          width={60}
          tickFormatter={v => (v > 0 ? `+${v.toLocaleString()}` : v.toLocaleString())}
        />
        <ReferenceLine y={0} stroke="#333333" strokeDasharray="3 3" />
        <Tooltip
          contentStyle={{
            background: '#111111',
            border: '1px solid #222222',
            borderRadius: 0,
            fontFamily: 'JetBrains Mono',
            fontSize: 11,
            color: '#ffffff',
          }}
          formatter={(v, name) => {
            const n = Number(v)
            return [n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString(), name as string]
          }}
          labelStyle={{ color: '#666666', marginBottom: 4 }}
        />
        <Legend
          wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11, paddingTop: 16 }}
          formatter={(v) => <span style={{ color: '#aaaaaa' }}>{v}</span>}
        />
        {players.map((name, i) => (
          <Line
            key={name}
            type="linear"
            dataKey={name}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={1.5}
            dot={{ r: 3, fill: COLORS[i % COLORS.length], strokeWidth: 0 }}
            activeDot={{ r: 4, strokeWidth: 0 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
