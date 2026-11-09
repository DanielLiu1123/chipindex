'use client'

import type { FormEvent, MouseEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import styles from './SessionPagination.module.css'
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
  getCompactSessionPaginationItems,
  sessionPageHref,
} from '@/lib/session-pagination'

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
  onPageChange?: (href: string) => void
}) {
  if (totalPages <= 1) return null
  const href = (next: number) => sessionPageHref(sessionsPath, next, pageSize)
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    const destination = event.currentTarget.getAttribute('href')
    if (!onPageChange || !destination || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onPageChange(destination)
  }
  function jumpToPage(event: FormEvent<HTMLFormElement>) {
    if (!onPageChange) return
    event.preventDefault()
    const next = Number(new FormData(event.currentTarget).get('page'))
    if (Number.isSafeInteger(next) && next >= 1 && next <= totalPages) onPageChange(href(next))
  }
  return (
    <div className={`mt-6 ${styles.container}`}>
      <div className={styles.controls}>
        <Pagination aria-label="Sessions pagination" className="mx-0 w-auto">
          <PaginationContent className={styles.pages}>
            <PaginationItem>
              <PaginationPrevious
                href={page > 1 ? href(page - 1) : undefined}
                onClick={navigate}
                aria-label="Previous page"
                aria-disabled={page === 1}
                tabIndex={page === 1 ? -1 : undefined}
                className={page === 1 ? 'pointer-events-none opacity-40' : ''}
              />
            </PaginationItem>
            {[
              { items: getSessionPaginationItems(page, totalPages), className: styles.expanded },
              { items: getCompactSessionPaginationItems(page, totalPages), className: styles.compact },
            ].flatMap(({ items, className }) => items.map((item, index) => (
              <PaginationItem
                className={className}
                key={`${className}-${index}`}
              >
                {item === 'ellipsis' ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    href={href(item)}
                    onClick={navigate}
                    isActive={item === page}
                    aria-label={`Go to page ${item}`}
                  >
                    {item}
                  </PaginationLink>
                )}
              </PaginationItem>
            )))}
            <PaginationItem>
              <PaginationNext
                href={page < totalPages ? href(page + 1) : undefined}
                onClick={navigate}
                aria-label="Next page"
                aria-disabled={page === totalPages}
                tabIndex={page === totalPages ? -1 : undefined}
                className={
                  page === totalPages ? 'pointer-events-none opacity-40' : ''
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
        {totalPages > 7 && (
          <form className={styles.jump} key={`${page}:${pageSize}`} action={sessionsPath} method="get" onSubmit={jumpToPage}>
            <Label className="flex items-center gap-2">
              GO
              <Input
                type="number"
                name="page"
                min="1"
                max={totalPages}
                aria-label="Go to page"
                className="w-16"
              />
            </Label>
            <input type="hidden" name="page_size" value={pageSize} />
          </form>
        )}
      </div>
    </div>
  )
}
