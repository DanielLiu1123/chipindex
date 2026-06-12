// Client-side adapter for the API routes. Centralizes the wire contract:
// JSON serialization, the { error } body shape, and non-2xx handling.
// Components call api() and catch ApiClientError instead of hand-rolling fetch.

export class ApiClientError extends Error {
  status: number
  payload: Record<string, unknown>

  constructor(status: number, payload: Record<string, unknown>) {
    super(typeof payload.error === 'string' ? payload.error : 'Request failed')
    this.status = status
    this.payload = payload
  }
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    ...(body !== undefined
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  })
  if (res.status === 204) return undefined as T
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiClientError(res.status, payload)
  return payload as T
}
