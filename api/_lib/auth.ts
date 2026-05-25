import { createHmac } from 'crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const PASSWORD = process.env.VITE_SHARED_PASSWORD!

export function generateToken(): string {
  return createHmac('sha256', 'chipindex').update(PASSWORD).digest('hex')
}

export function verifyToken(req: VercelRequest): boolean {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return false
  return auth.slice(7) === generateToken()
}

type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void>

export function withAuth(handler: Handler): Handler {
  return async (req, res) => {
    if (!verifyToken(req)) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    return handler(req, res)
  }
}
