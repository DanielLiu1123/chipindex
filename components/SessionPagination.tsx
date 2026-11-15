'use client'

import type { FormEvent, MouseEvent } from 'react'
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

const pageLinkClassName = '@max-[640px]/pagination:min-w-6 @max-[640px]/pagination:w-auto @max-[640px]/pagination:px-0.5 @max-[400px]/pagination:min-w-5 @max-[400px]/pagination:text-xs'

export default function SessionPagination({
  sessionsPath,
  page,
  pageSize,
  totalPages,
  onPageChange,
}: {
  sessionsPath: string
  page: number
  pageSize: number
  totalPages: number
  onPageChange: (href: string) => void
}) {
  if (totalPages <= 1) return null
  const href = (next: number) => sessionPageHref(sessionsPath, next, pageSize)
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
  function renderPages() {
    return getSessionPaginationItems(page, totalPages).map((item, index) => (
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
    ))
  }
  return (
    <div className="mt-6 @container/pagination">
      <div className="flex items-center justify-end gap-2 @min-[640px]/pagination:gap-3">
        <Pagination aria-label="Sessions pagination" className="mx-0 w-auto">
          <PaginationContent className="@max-[400px]/pagination:gap-0">
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
            {renderPages()}
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
            <Label className="flex items-center gap-1 @max-[400px]/pagination:text-xs @min-[640px]/pagination:gap-2">
              GO
              <Input
                type="number"
                name="page"
                min="1"
                max={totalPages}
                aria-label="Go to page"
                className="w-12 px-1 @max-[400px]/pagination:w-8 @max-[400px]/pagination:px-0.5 @min-[640px]/pagination:w-16 @min-[640px]/pagination:px-3"
              />
            </Label>
            <input type="hidden" name="page_size" value={pageSize} />
          </form>
        )}
      </div>
    </div>
  )
}
