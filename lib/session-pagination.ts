export const DEFAULT_SESSION_PAGE_SIZE = 10
export const MAX_SESSION_PAGE_SIZE = 100
export type SessionPaginationItem = number | 'ellipsis'

export function getSessionPaginationItems(currentPage: number, totalPages: number): SessionPaginationItem[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)

  const visible = new Set<number>([1, totalPages])
  if (currentPage <= 4) {
    for (let page = 1; page <= 5; page += 1) visible.add(page)
  } else if (currentPage >= totalPages - 3) {
    for (let page = totalPages - 4; page <= totalPages; page += 1) visible.add(page)
  } else {
    for (let page = currentPage - 2; page <= currentPage + 2; page += 1) visible.add(page)
  }

  const pages = [...visible].sort((a, b) => a - b)
  const items: SessionPaginationItem[] = []
  for (const page of pages) {
    const previous = items.at(-1)
    if (typeof previous === 'number' && page - previous > 1) items.push('ellipsis')
    items.push(page)
  }
  return items
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

export function sessionPageHref(basePath: string, page: number, pageSize: number): string {
  const params = new URLSearchParams()
  if (page > 1) params.set('page', String(page))
  if (pageSize !== DEFAULT_SESSION_PAGE_SIZE) params.set('page_size', String(pageSize))
  const query = params.toString()
  return query ? `${basePath}?${query}` : basePath
}
