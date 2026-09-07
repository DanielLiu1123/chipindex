import { GENERIC_ERROR_MESSAGE } from './error-message'
import { isAuthenticated } from './auth'
import { DomainError, type DomainErrorCode } from './domain-error'

const statusByCode: Record<DomainErrorCode, number> = {
  invalid_input: 400, not_found: 404, conflict: 409, rule_violation: 422, unbalanced: 422,
}
type RouteHandler<C> = (req: Request, ctx: C) => Promise<Response>

export function withAuth<C>(handler: RouteHandler<C>): RouteHandler<C> {
  return withErrorHandling(async (req, ctx) => {
    if (!await isAuthenticated()) {
      return Response.json({ code: 'unauthorized', error: 'Please sign in again.' }, { status: 401 })
    }
    return handler(req, ctx)
  })
}

export function withErrorHandling<C>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (error) {
      if (error instanceof DomainError) {
        return Response.json({ ...error.details, code: error.code, error: error.message }, { status: statusByCode[error.code] })
      }
      const requestId = crypto.randomUUID()
      console.error('Request failed', { requestId, method: req.method, path: new URL(req.url).pathname, error })
      return Response.json({ code: 'internal_error', error: GENERIC_ERROR_MESSAGE, request_id: requestId }, { status: 500 })
    }
  }
}
