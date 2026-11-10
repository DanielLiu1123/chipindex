'use client'

import { createContext, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { Table, TableCell, TableHead } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { measureTableColumns } from '@/lib/measure-table-columns'
import { allocateTableColumns, type ResponsiveColumn } from '@/lib/responsive-table'

export const TableLoadingContext = createContext(false)

const LayoutContext = createContext<readonly string[]>([])

export function ResponsiveTable({ columns, hideOrder, children, className, visibility = 'content' }: {
  columns: readonly ResponsiveColumn[]
  hideOrder: readonly string[]
  children: ReactNode
  visibility?: 'content' | 'container'
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
      const next = allocateTableColumns(width, columns, hideOrder, measured, visibility)
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
  }, [columns, hideOrder, children, visibility])
  const visible = layout?.visible ?? columns.map(column => column.key)
  return (
    <LayoutContext.Provider value={visible}>
      <div ref={ref}>
        <Table className={cn('table-fixed tabular-nums', className)}>
          <colgroup>{visible.map(key => <col key={key} style={{ width: layout?.widths[key] }} />)}</colgroup>
          {children}
        </Table>
      </div>
    </LayoutContext.Provider>
  )
}

type HeadProps = Omit<ComponentProps<typeof TableHead>, 'hidden' | 'colSpan'> & { column: string }
type CellProps = Omit<ComponentProps<typeof TableCell>, 'hidden' | 'colSpan'> & (
  | { column: string; span?: never }
  | { span: true; column?: never }
)

export function ResponsiveHead({ column, children, ...props }: HeadProps) {
  const visible = useContext(LayoutContext)
  return <TableHead {...props} data-column={column} hidden={!visible.includes(column)}><CellContent>{children}</CellContent></TableHead>
}

export function ResponsiveCell({ column, span, children, ...props }: CellProps) {
  const visible = useContext(LayoutContext)
  return <TableCell {...props} data-column={column} hidden={!span && !visible.includes(column)} colSpan={span ? visible.length : undefined}><CellContent>{children}</CellContent></TableCell>
}

export function HiddenColumnDetail({ column, children }: { column: string; children: ReactNode }) {
  const visible = useContext(LayoutContext)
  return visible.includes(column) ? null : children
}

function CellContent({ children }: { children: ReactNode }) {
  const loading = useContext(TableLoadingContext)
  if (!loading) return children
  return <div className="relative">
    <div className="invisible">{children}</div>
    <Skeleton className="absolute inset-x-0 top-1/2 h-4 -translate-y-1/2" />
  </div>
}
