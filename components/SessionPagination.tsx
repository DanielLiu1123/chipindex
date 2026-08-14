import Link from 'next/link'
import { sessionPageHref } from '@/lib/session-pagination'

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
  return (
    <nav aria-label="Sessions pagination"
      className="mt-6 flex flex-wrap items-center justify-end gap-x-4 gap-y-3 text-xs tracking-widest">
      <form key={`${page}:${pageSize}`} action={sessionsPath} method="get"
        className="flex flex-wrap items-center justify-end gap-3">
        <input type="hidden" name="page_size" value={pageSize} />
        <label className="flex items-center gap-2 text-muted">
          PAGE
          <input type="number" name="page" min="1" max={totalPages} defaultValue={page}
            aria-label="Page number"
            className="w-16 bg-surface border border-border px-2 py-1.5 text-right text-white outline-none focus:border-white" />
          <span>/ {totalPages}</span>
        </label>
        <button type="submit" className="border border-border px-3 py-1.5 text-muted hover:border-white hover:text-white transition-colors">
          GO
        </button>
      </form>
      {page > 1
        ? <Link href={sessionPageHref(sessionsPath, page - 1, pageSize)}
          className="text-muted hover:text-white transition-colors">← PREVIOUS</Link>
        : <span className="text-muted/30">← PREVIOUS</span>}
      {page < totalPages
        ? <Link href={sessionPageHref(sessionsPath, page + 1, pageSize)}
          className="text-muted hover:text-white transition-colors">NEXT →</Link>
        : <span className="text-muted/30">NEXT →</span>}
    </nav>
  )
}
