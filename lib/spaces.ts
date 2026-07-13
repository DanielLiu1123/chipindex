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
