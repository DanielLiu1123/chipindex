const BASE = process.env.SUPABASE_URL + '/rest/v1'
const KEY = process.env.SUPABASE_ANON_KEY!

function headers(single = false): Record<string, string> {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...(single ? { Accept: 'application/vnd.pgrst.object+json' } : {}),
  }
}

export async function selectMany<T = any>(table: string, query = ''): Promise<T[]> {
  const res = await fetch(`${BASE}/${table}${query ? '?' + query : ''}`, {
    headers: headers(),
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function selectOne<T = any>(table: string, query = ''): Promise<T> {
  const res = await fetch(`${BASE}/${table}${query ? '?' + query : ''}`, {
    headers: headers(true),
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function insertOne<T = any>(table: string, data: object): Promise<T> {
  const res = await fetch(`${BASE}/${table}`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function insertMany<T = any>(table: string, data: object[]): Promise<T[]> {
  const res = await fetch(`${BASE}/${table}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
