'use client'

import { useLayoutEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import {
  getSessionPaginationItems,
  sessionPageHref,
} from '@/lib/session-pagination'

const pageLinkClassName = 'w-auto min-w-5 px-0.5 text-xs @min-[400px]/pagination:min-w-6 @min-[400px]/pagination:text-sm @min-[640px]/pagination:w-10 @min-[640px]/pagination:px-0'

export default function SessionPagination({
  sessionsPath,
  page,
  pageSize,
  totalPages,
  query,
  onPageChange,
}: {
  sessionsPath: string
  page: number
  pageSize: number
  totalPages: number
  query?: [string, string][]
  onPageChange: (href: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measurementRef = useRef<HTMLDivElement>(null)
  const [interiorPageCount, setInteriorPageCount] = useState<3 | 5>(5)

  useLayoutEffect(() => {
    const container = containerRef.current
    const measurement = measurementRef.current
    if (!container || !measurement) return
    const update = () => setInteriorPageCount(
      measurement.getBoundingClientRect().width > container.getBoundingClientRect().width ? 3 : 5,
    )
    update()
    const observer = new ResizeObserver(update)
    observer.observe(container)
    observer.observe(measurement)
    return () => observer.disconnect()
  }, [page, totalPages])

  if (totalPages <= 1) return null
  const href = (next: number) => sessionPageHref(sessionsPath, next, pageSize, query)
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    const destination = event.currentTarget.getAttribute('href')
    if (!destination || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onPageChange(destination)
  }
  function jumpToPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = Number(new FormData(event.currentTarget).get('page'))
    if (Number.isSafeInteger(next) && next >= 1 && next <= totalPages) onPageChange(href(next))
  }
  function renderRow(count: 3 | 5) {
    return (
      <div className="ml-auto flex w-max items-center gap-2 @min-[640px]/pagination:gap-3">
        <Pagination aria-label="Sessions pagination" className="mx-0 w-auto shrink-0">
          <PaginationContent className="gap-0 @min-[400px]/pagination:gap-0.5">
            <PaginationItem>
              <PaginationPrevious
                href={page > 1 ? href(page - 1) : undefined}
                onClick={navigate}
                aria-label="Previous page"
                aria-disabled={page === 1}
                tabIndex={page === 1 ? -1 : undefined}
                className={`${pageLinkClassName} aria-disabled:pointer-events-none aria-disabled:opacity-40`}
              />
            </PaginationItem>
            {getSessionPaginationItems(page, totalPages, count).map((item, index) => (
              <PaginationItem key={item === 'ellipsis' ? `ellipsis-${index}` : item}>
                {item === 'ellipsis' ? (
                  <PaginationEllipsis className="w-3 @min-[640px]/pagination:w-8" />
                ) : (
                  <PaginationLink
                    className={pageLinkClassName}
                    href={href(item)}
                    onClick={navigate}
                    isActive={item === page}
                    aria-label={`Go to page ${item}`}
                  >
                    {item}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href={page < totalPages ? href(page + 1) : undefined}
                onClick={navigate}
                aria-label="Next page"
                aria-disabled={page === totalPages}
                tabIndex={page === totalPages ? -1 : undefined}
                className={`${pageLinkClassName} aria-disabled:pointer-events-none aria-disabled:opacity-40`}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
        {totalPages > 7 && (
          <form className="shrink-0" key={`${page}:${pageSize}`} action={sessionsPath} method="get" onSubmit={jumpToPage}>
            <Label className="flex items-center gap-1 text-xs @min-[400px]/pagination:text-sm @min-[640px]/pagination:gap-2">
              GO
              <Input
                type="number"
                name="page"
                min="1"
                max={totalPages}
                aria-label="Go to page"
                className="w-8 px-0.5 @min-[400px]/pagination:w-12 @min-[400px]/pagination:px-1 @min-[640px]/pagination:w-16 @min-[640px]/pagination:px-3"
              />
            </Label>
            <input type="hidden" name="page_size" value={pageSize} />
            {query?.map(([name, value]) => <input key={`${name}:${value}`} type="hidden" name={name} value={value} />)}
          </form>
        )}
      </div>
    )
  }
  return (
    <div ref={containerRef} className="relative mt-6 @container/pagination">
      {renderRow(interiorPageCount)}
      {/* Always measure the preferred range so the compact layout can grow back. */}
      <div aria-hidden="true" inert className="invisible pointer-events-none absolute inset-x-0 top-0 h-0 overflow-hidden">
        <div ref={measurementRef} className="w-max">{renderRow(5)}</div>
      </div>
    </div>
  )
}
