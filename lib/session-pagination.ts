export const DEFAULT_SESSION_PAGE_SIZE = 10
export const MAX_SESSION_PAGE_SIZE = 100
export type SessionPaginationItem = number | 'ellipsis'

const INTERIOR_PAGE_COUNT = 5

export function getSessionPaginationItems(currentPage: number, totalPages: number): SessionPaginationItem[] {
  if (totalPages <= INTERIOR_PAGE_COUNT + 2) return Array.from({ length: totalPages }, (_, index) => index + 1)

  // Keep five interior pages centered on the current page, clamping at either end.
  const start = Math.max(2, Math.min(currentPage - Math.floor(INTERIOR_PAGE_COUNT / 2), totalPages - INTERIOR_PAGE_COUNT))
  const end = start + INTERIOR_PAGE_COUNT - 1
  return [
    1,
    ...(start > 2 ? ['ellipsis' as const] : []),
    ...Array.from({ length: INTERIOR_PAGE_COUNT }, (_, index) => start + index),
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

export function sessionPageHref(basePath: string, page: number, pageSize: number): string {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('page_size', String(pageSize))
  return `${basePath}?${params.toString()}`
}
