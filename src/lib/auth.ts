const TOKEN_KEY = 'chipindex_token'

export async function login(password: string): Promise<boolean> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) return false
  const { token } = await res.json()
  localStorage.setItem(TOKEN_KEY, token)
  return true
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem(TOKEN_KEY)
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
