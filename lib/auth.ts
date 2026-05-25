import { createHmac } from 'crypto'
import { cookies } from 'next/headers'

const COOKIE = 'chipindex_auth'

export function generateToken(): string {
  return createHmac('sha256', 'chipindex')
    .update(process.env.SHARED_PASSWORD!)
    .digest('hex')
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies()
  return store.get(COOKIE)?.value === generateToken()
}
