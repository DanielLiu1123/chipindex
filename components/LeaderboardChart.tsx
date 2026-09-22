'use client'

import { Toggle } from '@/components/ui/toggle'
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart'

import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  type TooltipContentProps,
  type TooltipValueType,
} from 'recharts'
import { sortTooltipItems } from '@/lib/chart'
import { formatAmount } from '@/lib/format'

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
]

interface ChartPoint {
  date: string
  [player: string]: string | number
}
interface ChartPlayer {
  id: string
  name: string
}

export function SortedTooltipContent(
  props: TooltipContentProps<TooltipValueType>,
) {
  const payload = sortTooltipItems(props.payload)
  return (
    <ChartTooltipContent
      active={props.active}
      payload={payload}
      label={props.label}
      formatter={props.formatter}
    />
  )
}

export default function LeaderboardChart({
  data,
  players,
  mode,
}: {
  data: ChartPoint[]
  players: ChartPlayer[]
  mode: 'chips' | 'cny'
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const visible =
    selected.size === 0 ? new Set(players.map((player) => player.id)) : selected

  return (
    <div>
      <ChartContainer
        className="h-[360px] w-full"
        config={Object.fromEntries(
          players.map((player, index) => [
            player.id,
            { label: player.name, color: COLORS[index % COLORS.length] },
          ]),
        )}
      >
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <XAxis
            dataKey="date"
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={60}
            tickFormatter={(v) =>
              mode === 'cny'
                ? v >= 0
                  ? `¥${formatAmount(v)}`
                  : `-¥${formatAmount(Math.abs(v))}`
                : v > 0
                  ? `+${v.toLocaleString()}`
                  : v.toLocaleString()
            }
          />
          <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="3 3" />
          <Tooltip
            content={SortedTooltipContent}
            formatter={(v, name, item) => {
              if (!visible.has(String(item.dataKey))) return null
              const n = Number(v)
              const formatted =
                mode === 'cny'
                  ? n >= 0
                    ? `¥${formatAmount(n)}`
                    : `-¥${formatAmount(Math.abs(n))}`
                  : n > 0
                    ? `+${n.toLocaleString()}`
                    : n.toLocaleString()
              return (
                <div className="flex w-full items-center justify-between gap-4">
                  <span className="text-muted-foreground">{name}</span>
                  <span className="font-mono tabular-nums">{formatted}</span>
                </div>
              )
            }}
          />
          {players.map((player, i) => (
            <Line
              key={player.id}
              type="linear"
              dataKey={player.id}
              name={player.name}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={visible.has(player.id) ? 1.5 : 0}
              dot={
                visible.has(player.id)
                  ? { r: 3, fill: COLORS[i % COLORS.length], strokeWidth: 0 }
                  : false
              }
              activeDot={
                visible.has(player.id) ? { r: 4, strokeWidth: 0 } : false
              }
              connectNulls
            />
          ))}
        </LineChart>
      </ChartContainer>

      <div className="flex flex-wrap justify-center gap-2 mt-4 px-2">
        {players.map((player, i) => {
          const isActive = selected.size === 0 || selected.has(player.id)
          return (
            <Toggle
              pressed={isActive}
              aria-label={player.name}
              type="button"
              key={player.id}
              onPressedChange={() => toggle(player.id)}

              style={{ opacity: isActive ? 1 : 0.3 }}
            >
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span>{player.name}</span>
            </Toggle>
          )
        })}
      </div>
    </div>
  )
}
