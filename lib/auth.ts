import { cookies } from 'next/headers'

export const AUTH_COOKIE = 'chipindex_auth'

let cachedToken: string | null = null

export async function generateToken(): Promise<string> {
  if (cachedToken) return cachedToken
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('chipindex'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(process.env.SHARED_PASSWORD!)
  )
  cachedToken = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return cachedToken
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies()
  return store.get(AUTH_COOKIE)?.value === await generateToken()
}
