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

export default function SessionPagination({
  sessionsPath,
  page,
  pageSize,
  totalPages,
}: {
  sessionsPath: string
  page: number
  pageSize: number
  totalPages: number
}) {
  if (totalPages <= 1) return null
  const href = (next: number) => sessionPageHref(sessionsPath, next, pageSize)
  return (
    <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
      <Pagination aria-label="Sessions pagination" className="mx-0 w-auto">
        <PaginationContent className="flex-wrap justify-center">
          <PaginationItem>
            <PaginationPrevious
              href={page > 1 ? href(page - 1) : undefined}
              aria-label="Previous page"
              aria-disabled={page === 1}
              tabIndex={page === 1 ? -1 : undefined}
              className={page === 1 ? 'pointer-events-none opacity-40' : ''}
            />
          </PaginationItem>
          {getSessionPaginationItems(page, totalPages).map((item, index) => (
            <PaginationItem
              key={item === 'ellipsis' ? `ellipsis-${index}` : item}
            >
              {item === 'ellipsis' ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  href={href(item)}
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
        <form key={`${page}:${pageSize}`} action={sessionsPath} method="get">
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
  )
}
