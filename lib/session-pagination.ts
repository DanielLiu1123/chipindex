export const DEFAULT_SESSION_PAGE_SIZE = 10
export const MAX_SESSION_PAGE_SIZE = 100

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
