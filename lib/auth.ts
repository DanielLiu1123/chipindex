import { cookies } from 'next/headers'

const COOKIE = 'chipindex_auth'

export async function generateToken(): Promise<string> {
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
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies()
  return store.get(COOKIE)?.value === await generateToken()
}
