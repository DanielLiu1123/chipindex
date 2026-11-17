export const DEFAULT_SESSION_PAGE_SIZE = 10
export const MAX_SESSION_PAGE_SIZE = 100
export type SessionPaginationItem = number | 'ellipsis'

export function getSessionPaginationItems(currentPage: number, totalPages: number, interiorPageCount: 3 | 5 = 5): SessionPaginationItem[] {
  if (totalPages <= interiorPageCount + 2) return Array.from({ length: totalPages }, (_, index) => index + 1)

  // Keep interior pages centered on the current page, clamping at either end.
  const start = Math.max(2, Math.min(currentPage - Math.floor(interiorPageCount / 2), totalPages - interiorPageCount))
  const end = start + interiorPageCount - 1
  return [
    1,
    ...(start > 2 ? ['ellipsis' as const] : []),
    ...Array.from({ length: interiorPageCount }, (_, index) => start + index),
    ...(end < totalPages - 1 ? ['ellipsis' as const] : []),
    totalPages,
  ]
}

export function normalizeSessionPageParam(
  value: string | string[] | undefined,
  fallback: number,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number(raw)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, maximum)
}

export function hasCanonicalSessionPageParams(
  pageParam: string | string[] | undefined,
  pageSizeParam: string | string[] | undefined,
  page: number,
  pageSize: number,
): boolean {
  const rawPage = Array.isArray(pageParam) ? pageParam[0] : pageParam
  const rawPageSize = Array.isArray(pageSizeParam) ? pageSizeParam[0] : pageSizeParam
  return rawPage === String(page) && rawPageSize === String(pageSize)
}

export function sessionPageHref(basePath: string, page: number, pageSize: number, query: [string, string][] = []): string {
  const params = new URLSearchParams(query)
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  return `${basePath}?${params.toString()}`
}
