'use client'

import { useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const COLORS = [
  '#00ff88', '#6bcfff', '#ffd93d', '#ff6b6b',
  '#c77dff', '#ff8c42', '#ff77ab', '#a8dadc',
]

interface ChartPoint { date: string; [player: string]: string | number }

export default function LeaderboardChart({ data, players }: { data: ChartPoint[]; players: string[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggle(name: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const visible = selected.size === 0 ? new Set(players) : selected

  return (
    <div>
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
              if (!visible.has(name as string)) return [null, null]
              const n = Number(v)
              return [n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString(), name as string]
            }}
            labelStyle={{ color: '#666666', marginBottom: 4 }}
          />
          {players.map((name, i) => (
            <Line
              key={name}
              type="linear"
              dataKey={name}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={visible.has(name) ? 1.5 : 0}
              dot={visible.has(name) ? { r: 3, fill: COLORS[i % COLORS.length], strokeWidth: 0 } : false}
              activeDot={visible.has(name) ? { r: 4, strokeWidth: 0 } : false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap justify-center gap-2 mt-4 px-2">
        {players.map((name, i) => {
          const isActive = selected.size === 0 || selected.has(name)
          return (
            <button
              key={name}
              onClick={() => toggle(name)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs tracking-wide transition-opacity"
              style={{ opacity: isActive ? 1 : 0.3 }}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span style={{ color: isActive ? '#aaaaaa' : '#555555', fontFamily: 'JetBrains Mono' }}>
                {name}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
