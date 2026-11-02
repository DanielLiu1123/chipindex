'use client'

import { SegmentedControl } from '@/components/ui/segmented-control'

const OPTIONS = [
  { value: 'cny', label: 'CNY' },
  { value: 'chips', label: 'CHIPS' },
] as const

type ValueUnit = (typeof OPTIONS)[number]['value']

export default function ValueUnitControl({ value, onValueChange }: {
  value: ValueUnit
  onValueChange: (value: ValueUnit) => void
}) {
  return <SegmentedControl value={value} onValueChange={onValueChange} label="Value unit" compact options={OPTIONS} />
}
