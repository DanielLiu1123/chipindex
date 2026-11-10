/** Share remaining space equally, pinning columns whose content needs more room. */
export function distributeColumnWidths(width: number, minimum: Record<string, number>): Record<string, number> {
  const widths: Record<string, number> = {}
  let pending = Object.keys(minimum)
  let remaining = width
  while (pending.length) {
    const share = remaining / pending.length
    const constrained = pending.filter(key => minimum[key] > share)
    if (!constrained.length) {
      for (const key of pending) widths[key] = share
      break
    }
    for (const key of constrained) {
      widths[key] = minimum[key]
      remaining -= widths[key]
    }
    pending = pending.filter(key => !constrained.includes(key))
  }
  return widths
}
