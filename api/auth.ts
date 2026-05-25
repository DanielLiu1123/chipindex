import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateToken } from './_lib/auth'

const PASSWORD = process.env.VITE_SHARED_PASSWORD!

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }
  const { password } = req.body as { password: string }
  if (password !== PASSWORD) {
    res.status(401).json({ error: 'Wrong password' })
    return
  }
  res.json({ token: generateToken() })
}
