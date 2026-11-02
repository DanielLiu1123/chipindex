'use client'

import type { ReactNode } from 'react'
import { ToggleGroup } from 'radix-ui'

type Option<T extends string> = {
  value: T
  label: string
  icon?: ReactNode
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  compact = false,
}: {
  value: T
  onValueChange: (value: T) => void
  options: readonly Option<T>[]
  label: string
  compact?: boolean
}) {
  const index = options.findIndex(option => option.value === value)

  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={next => {
        const option = options.find(option => option.value === next)
        if (option) onValueChange(option.value)
      }}
      aria-label={label}
      orientation="horizontal"
      loop
      className="relative isolate inline-grid w-fit shrink-0 rounded-xl bg-muted p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-1 -z-10">
        <span
          className="block h-full rounded-lg bg-background shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{ width: `${100 / options.length}%`, transform: `translateX(${Math.max(0, index) * 100}%)` }}
        />
      </span>
      {options.map(option => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          onFocus={() => onValueChange(option.value)}
          className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=on]:text-foreground motion-reduce:transition-none [&_svg]:size-4 [&_svg]:shrink-0 ${compact ? 'min-h-9 px-3' : 'min-h-10 px-4'}`}
        >
          {option.icon}
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
