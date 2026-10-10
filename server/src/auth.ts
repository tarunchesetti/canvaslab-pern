import type { Request, RequestHandler } from 'express'

type AuthenticatedRequest = Request & {
  session: Request['session'] & { userId: string }
}

export const requireAuth: RequestHandler = (request, response, next) => {
  if (!request.session.userId) {
    response.status(401).json({ error: 'Authentication required' })
    return
  }

  next()
}

export function sessionUserId(request: Request): string {
  return (request as AuthenticatedRequest).session.userId
}
