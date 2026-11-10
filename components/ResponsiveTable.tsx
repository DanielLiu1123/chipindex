'use client'

import { createContext, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { Table, TableCell, TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { measureTableColumns } from '@/lib/measure-table-columns'
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
      measured ??= measureTableColumns(table, context, columns)
      const next = allocateTableColumns(width, columns, hideOrder, measured)
      setLayout(previous => previous && columns.every(column => previous.widths[column.key] === next.widths[column.key]) ? previous : next)
    }
    function fontsChanged() {
      measured = null
      update()
    }
    const observer = new ResizeObserver(update)
    observer.observe(container)
    update()
    void document.fonts?.ready.then(fontsChanged)
    document.fonts?.addEventListener('loadingdone', fontsChanged)
    return () => {
      active = false
      observer.disconnect()
      document.fonts?.removeEventListener('loadingdone', fontsChanged)
    }
  }, [columns, hideOrder, children])
  const visible = layout?.visible ?? columns.map(column => column.key)
  return (
    <LayoutContext.Provider value={{ visible }}>
      <div ref={ref}>
        <Table className={cn('table-fixed tabular-nums', className)}>
          <colgroup>{visible.map(key => <col key={key} style={{ width: layout?.widths[key] }} />)}</colgroup>
          {children}
        </Table>
      </div>
    </LayoutContext.Provider>
  )
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
