import { isAuthenticated } from './auth'

// Shared shell for API route handlers: authentication and the error response
// shape live here, so individual routes contain only domain logic.

// Thrown anywhere below a route handler to produce a JSON error response.
// `payload` carries extra fields merged into the body (e.g. conservation diff).
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public payload?: Record<string, unknown>,
  ) {
    super(message)
  }
}

type RouteHandler<C> = (req: Request, ctx: C) => Promise<Response>

export function withAuth<C>(handler: RouteHandler<C>): RouteHandler<C> {
  const authenticatedHandler = withErrorHandling(handler)
  return async (req, ctx) => {
    if (!await isAuthenticated()) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return authenticatedHandler(req, ctx)
  }
}

export function withErrorHandling<C>(handler: RouteHandler<C>): RouteHandler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx)
    } catch (e) {
      if (e instanceof ApiError) {
        return Response.json({ error: e.message, ...e.payload }, { status: e.status })
      }
      const message = e instanceof Error ? e.message : 'Internal error'
      return Response.json({ error: message }, { status: 500 })
    }
  }
}
