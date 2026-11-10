'use client'

import { createContext, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { Table, TableCell, TableHead } from '@/components/ui/table'
import { allocateTableColumns, type ResponsiveColumn } from '@/lib/responsive-table'

const LayoutContext = createContext<{ visible: string[] } | null>(null)

export function ResponsiveTable({ columns, hideOrder, children, className }: {
  columns: readonly ResponsiveColumn[]
  hideOrder: readonly string[]
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<ReturnType<typeof allocateTableColumns> | null>(null)
  useEffect(() => {
    const container = ref.current
    const table = container?.querySelector('table')
    if (!container || !table) return
    let context: CanvasRenderingContext2D | null = null
    let active = true
    let measured: Record<string, number> | null = null
    function update() {
      if (!active || !container || !table) return
      const width = table.parentElement!.clientWidth
      if (!width) return
      context ??= document.createElement('canvas').getContext('2d')
      if (!context) return
      if (!measured) {
        measured = {}
        for (const column of columns) {
          let maximum = column.minWidth
          for (const cell of table.querySelectorAll<HTMLElement>(`[data-column="${column.key}"]`)) {
            const text = cell.querySelector('[data-measure-text]') ?? cell
            const style = getComputedStyle(text)
            context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
            const padding = getComputedStyle(cell)
            maximum = Math.max(maximum, context.measureText(text.textContent ?? '').width + (parseFloat(padding.paddingLeft) || 0) + (parseFloat(padding.paddingRight) || 0) + (column.extraWidth ?? 0))
          }
          measured[column.key] = Math.ceil(maximum)
        }
      }
      const next = allocateTableColumns(width, columns, hideOrder, measured)
      setLayout(previous => previous && columns.every(column => previous.widths[column.key] === next.widths[column.key]) ? previous : next)
    }
    function fontsChanged() { measured = null; update() }
    const observer = new ResizeObserver(update)
    observer.observe(container)
    update()
    void document.fonts?.ready.then(fontsChanged)
    document.fonts?.addEventListener('loadingdone', fontsChanged)
    return () => { active = false; observer.disconnect(); document.fonts?.removeEventListener('loadingdone', fontsChanged) }
  }, [columns, hideOrder, children])
  const visible = layout?.visible ?? columns.map(column => column.key)
  return <LayoutContext.Provider value={{ visible }}><div ref={ref}>
    <Table className={`table-fixed tabular-nums ${className ?? ''}`}>
      <colgroup>{visible.map(key => <col key={key} style={{ width: layout?.widths[key] }} />)}</colgroup>
      {children}
    </Table>
  </div></LayoutContext.Provider>
}

export function ResponsiveHead({ column, ...props }: ComponentProps<typeof TableHead> & { column: string }) {
  const layout = useContext(LayoutContext)
  return <TableHead {...props} data-column={column} hidden={layout ? !layout.visible.includes(column) : false} />
}

export function ResponsiveCell({ column, span, ...props }: ComponentProps<typeof TableCell> & { column?: string; span?: boolean }) {
  const layout = useContext(LayoutContext)
  return <TableCell {...props} data-column={column} hidden={column && layout ? !layout.visible.includes(column) : false} colSpan={span ? layout?.visible.length : props.colSpan} />
}

export function HiddenColumnDetail({ column, children }: { column: string; children: ReactNode }) {
  const layout = useContext(LayoutContext)
  return layout && !layout.visible.includes(column) ? children : null
}
