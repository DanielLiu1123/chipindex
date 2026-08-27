import Link from 'next/link'
import { getSessionPaginationItems, sessionPageHref } from '@/lib/session-pagination'

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
  const items = getSessionPaginationItems(page, totalPages)
  const arrowClass = 'inline-flex h-11 min-w-11 items-center justify-center border border-border px-2 transition-colors sm:h-9 sm:min-w-9'

  return (
    <nav aria-label="Sessions pagination"
      className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs tracking-widest sm:justify-end">
      <div className="flex items-center gap-1">
        {page > 1
          ? <Link href={sessionPageHref(sessionsPath, page - 1, pageSize)} aria-label="Previous page"
            className={`${arrowClass} text-muted hover:border-white hover:text-white`}>‹</Link>
          : <span aria-hidden="true" className={`${arrowClass} text-muted/30`}>‹</span>}
        {items.map((item, index) => item === 'ellipsis'
          ? <span key={`ellipsis-${index}`} aria-hidden="true"
            className="inline-flex h-11 min-w-7 items-center justify-center text-muted max-sm:hidden sm:h-9">…</span>
          : item === page
            ? <span key={item} aria-current="page"
              className="inline-flex h-11 min-w-11 items-center justify-center border border-accent bg-accent/5 px-2 text-accent sm:h-9 sm:min-w-9">{item}</span>
            : <Link key={item} href={sessionPageHref(sessionsPath, item, pageSize)}
              aria-label={`Go to page ${item}`}
              className="inline-flex h-11 min-w-11 items-center justify-center border border-transparent px-2 text-muted transition-colors hover:border-border hover:text-white max-sm:hidden sm:h-9 sm:min-w-9">{item}</Link>)}
        {page < totalPages
          ? <Link href={sessionPageHref(sessionsPath, page + 1, pageSize)} aria-label="Next page"
            className={`${arrowClass} text-muted hover:border-white hover:text-white`}>›</Link>
          : <span aria-hidden="true" className={`${arrowClass} text-muted/30`}>›</span>}
      </div>
      {totalPages > 7 && <form key={`${page}:${pageSize}`} action={sessionsPath} method="get">
        <label className="flex items-center gap-2 text-muted">
          GO
          <input type="number" name="page" min="1" max={totalPages} aria-label="Go to page"
            className="min-h-11 w-16 border border-border bg-surface px-2 py-2 text-right text-white outline-none focus:border-white sm:min-h-0 sm:w-14" />
        </label>
        <input type="hidden" name="page_size" value={pageSize} />
      </form>}
    </nav>
  )
}
