const BASE = process.env.SUPABASE_URL + '/rest/v1'
const KEY = process.env.SUPABASE_ANON_KEY!

function headers(single = false) {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...(single ? { Accept: 'application/vnd.pgrst.object+json' } : {}),
  }
}

export async function selectMany(table: string, query = '') {
  const res = await fetch(`${BASE}/${table}${query ? '?' + query : ''}`, { headers: headers() })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function selectOne(table: string, query = '') {
  const res = await fetch(`${BASE}/${table}${query ? '?' + query : ''}`, { headers: headers(true) })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function insertOne(table: string, data: object) {
  const res = await fetch(`${BASE}/${table}`, {
    method: 'POST',
    headers: headers(true),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function insertMany(table: string, data: object[]) {
  const res = await fetch(`${BASE}/${table}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
