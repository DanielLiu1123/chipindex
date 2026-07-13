export const AUTH_COOKIE = 'chipindex_auth'

// Parse SPACES="name:password,name2:password2" into name→password.
// First colon splits name:password; comma separates spaces. Names and
// passwords must not contain ',' or ':'.
export function parseSpaces(raw: string | undefined): Map<string, string> {
  const map = new Map<string, string>()
  if (!raw) return map
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf(':')
    if (idx <= 0) continue
    const name = pair.slice(0, idx).trim()
    const password = pair.slice(idx + 1).trim()
    if (name && password) map.set(name, password)
  }
  return map
}

export function spaceForPassword(pw: string, spaces: Map<string, string>): string | null {
  if (!pw) return null
  for (const [name, password] of spaces) {
    if (password === pw) return name
  }
  return null
}

const enc = new TextEncoder()

async function hmacHex(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', k, enc.encode(msg))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function b64urlEncode(s: string): string {
  let bin = ''
  for (const b of enc.encode(s)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export async function makeCookie(name: string, password: string): Promise<string> {
  return `${b64urlEncode(name)}.${await hmacHex(password, name)}`
}

export async function verifySpaceCookie(
  value: string | undefined,
  spaces: Map<string, string>,
): Promise<string | null> {
  if (!value) return null
  const dot = value.lastIndexOf('.')
  if (dot <= 0) return null
  let name: string
  try {
    name = b64urlDecode(value.slice(0, dot))
  } catch {
    return null
  }
  const sig = value.slice(dot + 1)
  const password = spaces.get(name)
  if (!password) return null
  const expected = await hmacHex(password, name)
  if (sig.length !== expected.length) return null
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0 ? name : null
}
