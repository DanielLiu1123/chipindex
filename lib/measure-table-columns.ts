interface MeasuredColumn {
  key: string
  extraWidth?: number
}

/** Measure hidden columns too, so they can return when the container grows. */
export function measureTableColumns(
  table: HTMLTableElement,
  context: CanvasRenderingContext2D,
  columns: readonly MeasuredColumn[],
  reserveSortArrow = false,
): Record<string, number> {
  return Object.fromEntries(columns.map(({ key, extraWidth = 0 }) => {
    let maximum = 0
    for (const cell of table.querySelectorAll<HTMLElement>(`[data-column="${key}"]`)) {
      const text = cell.querySelector('[data-measure-text]') ?? (reserveSortArrow ? cell.querySelector('button, a') : null) ?? cell
      const style = getComputedStyle(text)
      // The shorthand can be empty when font-variant-numeric is tabular-nums.
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      const content = text.textContent ?? ''
      const value = reserveSortArrow && cell.tagName === 'TH' && cell.querySelector('button')
        ? content.replace(/[↑↓]/g, '').trim() + ' ↓'
        : content
      const cellStyle = getComputedStyle(cell)
      const padding = (parseFloat(cellStyle.paddingLeft) || 0) + (parseFloat(cellStyle.paddingRight) || 0)
      maximum = Math.max(maximum, context.measureText(value).width + padding + extraWidth)
    }
    return [key, Math.ceil(maximum)]
  }))
}
