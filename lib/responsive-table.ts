export interface ResponsiveColumn {
  key: string
  minWidth: number
  /** Text columns may wrap at the minimum-column layout. */
  wrap?: boolean
  /** Space reserved for controls alongside text. */
  extraWidth?: number
  fixed?: boolean
}

export function allocateTableColumns(width: number, columns: readonly ResponsiveColumn[], hideOrder: readonly string[], measured: Record<string, number> = {}) {
  const minimum = Object.fromEntries(columns.map(column => [column.key, Math.max(column.minWidth, measured[column.key] ?? 0)]))
  let visible = [...columns]
  for (const key of hideOrder) {
    if (visible.reduce((sum, column) => sum + minimum[column.key], 0) <= width) break
    visible = visible.filter(column => column.key !== key)
  }
  // Only shrink wrapping text; never silently clip amounts or action controls.
  const wrapping = visible.filter(column => column.wrap)
  const required = visible.filter(column => !column.wrap).reduce((sum, column) => sum + minimum[column.key], 0)
  for (const column of wrapping) minimum[column.key] = Math.min(minimum[column.key], Math.max(48, (width - required) / wrapping.length))
  const widths: Record<string, number> = {}
  let pending = visible.filter(column => !column.fixed)
  let remaining = width
  for (const column of visible.filter(column => column.fixed)) {
    widths[column.key] = minimum[column.key]
    remaining -= widths[column.key]
  }
  while (pending.length) {
    const share = remaining / pending.length
    const constrained = pending.filter(column => minimum[column.key] > share)
    if (!constrained.length) {
      for (const column of pending) widths[column.key] = share
      break
    }
    for (const column of constrained) {
      widths[column.key] = minimum[column.key]
      remaining -= widths[column.key]
    }
    pending = pending.filter(column => !constrained.includes(column))
  }
  return { visible: visible.map(column => column.key), widths }
}
