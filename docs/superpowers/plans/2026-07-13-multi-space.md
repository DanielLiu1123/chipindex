# Multi-Space Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope all session/buy-in data to a named "space" (a game), selected purely by which password the user enters at login — zero UI change.

**Architecture:** A shared password map (`SPACES` env) maps password → space name. Login sets a signed cookie carrying the space name. Server-side `currentSpace()` reads+verifies that cookie; `queries.ts`/`mutations.ts` inject `.eq('space', ...)` on every `session` read and inject `space` on every `session` insert, plus an ownership guard before id-based writes. Players stay global (no `space` column); participant/buy-in rows inherit space via `session_id`.

**Tech Stack:** Next.js 15 (App Router), Supabase JS (anon key), Web Crypto (HMAC-SHA256), vitest.

## Global Constraints

- **Zero UI change**: no new inputs, dropdowns, pages, or navigation. `app/login/page.tsx` is NOT modified.
- **Players are global**: `player` table gets no `space` column; `createPlayer`/`renamePlayer` unchanged.
- **Space column lives only on `session`**: participant/buy-in inherit via `session_id`.
- **Crypto must run in Edge middleware AND Node route handlers**: use Web Crypto (`crypto.subtle`, `btoa`/`atob`) only — no Node `crypto` module.
- **Cookie name**: `chipindex_auth` (unchanged constant `AUTH_COOKIE`).
- **Cookie format**: `base64url(spaceName) + "." + hex(HMAC-SHA256(key=spacePassword, msg=spaceName))`.
- **env format**: `SPACES=游戏A:密码A,游戏B:密码B` — comma separates spaces, first colon separates name:password; name/password must not contain `,` or `:`.
- Design reference: `docs/superpowers/specs/2026-07-13-multi-space-design.md`.

**Prerequisite (execution):** work on a branch, not `main`. Create `feat/multi-space` before Task 1.

---

## File Structure

- `lib/spaces.ts` (**new**) — env parsing, password→space lookup, cookie sign/verify, `currentSpace()`/`requireSpace()`, `AUTH_COOKIE`. Single responsibility: everything about "what space am I in".
- `lib/auth.ts` (**modify**) — reduce to `isAuthenticated()` delegating to `currentSpace()`; drop single-password token.
- `middleware.ts` (**modify**) — validate space cookie via `verifySpaceCookie` using `request.cookies`.
- `app/api/auth/route.ts` (**modify**) — POST maps password→space, sets signed cookie; fixes empty-password bypass.
- `lib/queries.ts` (**modify**) — inject space filter on 7 session reads.
- `lib/mutations.ts` (**modify**) — inject space on inserts + `requireSessionInSpace` guard + space-aware `requireOpenSession`.
- `schema.sql` (**modify**) — `session.space text not null` + index; migration snippet documented.
- `.env.example` (**modify**) — `SHARED_PASSWORD` → `SPACES`.
- `lib/spaces.test.ts` (**new**) — unit tests for parsing + sign/verify.

---

## Task 1: Space env parsing + password lookup

**Files:**
- Create: `lib/spaces.ts`
- Test: `lib/spaces.test.ts`

**Interfaces:**
- Produces:
  - `export const AUTH_COOKIE = 'chipindex_auth'`
  - `export function parseSpaces(raw: string | undefined): Map<string, string>` — name→password
  - `export function spaceForPassword(pw: string, spaces: Map<string, string>): string | null`

- [ ] **Step 1: Write the failing test**

```ts
// lib/spaces.test.ts
import { describe, it, expect } from 'vitest'
import { parseSpaces, spaceForPassword } from './spaces'

describe('parseSpaces', () => {
  it('parses multiple space:password pairs', () => {
    const m = parseSpaces('游戏A:pa,游戏B:pb')
    expect(m.get('游戏A')).toBe('pa')
    expect(m.get('游戏B')).toBe('pb')
    expect(m.size).toBe(2)
  })
  it('returns empty map for undefined/empty', () => {
    expect(parseSpaces(undefined).size).toBe(0)
    expect(parseSpaces('').size).toBe(0)
  })
  it('skips malformed entries (no colon, empty name/password)', () => {
    const m = parseSpaces('good:pw,nocolon,:nopw,noname:')
    expect(m.size).toBe(1)
    expect(m.get('good')).toBe('pw')
  })
})

describe('spaceForPassword', () => {
  const spaces = parseSpaces('游戏A:pa,游戏B:pb')
  it('returns the space name whose password matches', () => {
    expect(spaceForPassword('pa', spaces)).toBe('游戏A')
    expect(spaceForPassword('pb', spaces)).toBe('游戏B')
  })
  it('returns null for unknown or empty password', () => {
    expect(spaceForPassword('nope', spaces)).toBeNull()
    expect(spaceForPassword('', spaces)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/spaces.test.ts`
Expected: FAIL — `Failed to resolve import "./spaces"` / functions not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/spaces.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/spaces.test.ts`
Expected: PASS (both describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add lib/spaces.ts lib/spaces.test.ts
git commit -m "feat: parse SPACES env and map password to space"
```

---

## Task 2: Cookie sign + verify

**Files:**
- Modify: `lib/spaces.ts`
- Test: `lib/spaces.test.ts`

**Interfaces:**
- Produces:
  - `export async function makeCookie(name: string, password: string): Promise<string>` — returns `base64url(name).hmacHex`
  - `export async function verifySpaceCookie(value: string | undefined, spaces: Map<string, string>): Promise<string | null>` — returns space name if signature valid for a configured space, else null

- [ ] **Step 1: Write the failing test**

```ts
// append to lib/spaces.test.ts
import { makeCookie, verifySpaceCookie } from './spaces'

describe('cookie sign/verify', () => {
  const spaces = parseSpaces('游戏A:pa,游戏B:pb')

  it('round-trips a valid cookie back to its space name', async () => {
    const cookie = await makeCookie('游戏A', 'pa')
    expect(await verifySpaceCookie(cookie, spaces)).toBe('游戏A')
  })

  it('rejects a tampered signature', async () => {
    const cookie = await makeCookie('游戏A', 'pa')
    const tampered = cookie.slice(0, -1) + (cookie.endsWith('0') ? '1' : '0')
    expect(await verifySpaceCookie(tampered, spaces)).toBeNull()
  })

  it('rejects a cookie whose space is no longer configured', async () => {
    const cookie = await makeCookie('游戏C', 'pc') // not in spaces
    expect(await verifySpaceCookie(cookie, spaces)).toBeNull()
  })

  it('rejects a cookie signed with the wrong password', async () => {
    const cookie = await makeCookie('游戏A', 'WRONG')
    expect(await verifySpaceCookie(cookie, spaces)).toBeNull()
  })

  it('returns null for undefined/garbage input', async () => {
    expect(await verifySpaceCookie(undefined, spaces)).toBeNull()
    expect(await verifySpaceCookie('garbage', spaces)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/spaces.test.ts`
Expected: FAIL — `makeCookie`/`verifySpaceCookie` not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to lib/spaces.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/spaces.test.ts`
Expected: PASS (all cookie tests green).

- [ ] **Step 5: Commit**

```bash
git add lib/spaces.ts lib/spaces.test.ts
git commit -m "feat: sign and verify space cookies with per-space HMAC key"
```

---

## Task 3: `currentSpace()`/`requireSpace()` + auth delegation

**Files:**
- Modify: `lib/spaces.ts`
- Modify: `lib/auth.ts`

**Interfaces:**
- Consumes: `parseSpaces`, `verifySpaceCookie`, `AUTH_COOKIE` (Task 1–2)
- Produces:
  - `export const currentSpace: () => Promise<string | null>` (react-`cache`d)
  - `export async function requireSpace(): Promise<string>` (throws `Error('No active space')` if null)
  - `lib/auth.ts`: `export async function isAuthenticated(): Promise<boolean>`

- [ ] **Step 1: Add `currentSpace`/`requireSpace` to `lib/spaces.ts`**

```ts
// add imports at TOP of lib/spaces.ts
import { cache } from 'react'
import { cookies } from 'next/headers'

// add at END of lib/spaces.ts
export const currentSpace = cache(async (): Promise<string | null> => {
  const store = await cookies()
  const value = store.get(AUTH_COOKIE)?.value
  return verifySpaceCookie(value, parseSpaces(process.env.SPACES))
})

export async function requireSpace(): Promise<string> {
  const space = await currentSpace()
  if (!space) throw new Error('No active space')
  return space
}
```

- [ ] **Step 2: Rewrite `lib/auth.ts`**

Replace the ENTIRE contents of `lib/auth.ts` with:

```ts
import { currentSpace, AUTH_COOKIE } from './spaces'

export { AUTH_COOKIE }

// Authenticated iff the request carries a valid, in-config space cookie.
export async function isAuthenticated(): Promise<boolean> {
  return (await currentSpace()) !== null
}
```

- [ ] **Step 3: Verify unit tests still pass and types compile**

Run: `npx vitest run lib/spaces.test.ts && npx tsc --noEmit`
Expected: vitest PASS; tsc no errors.

(Note: `parseSpaces`/`spaceForPassword`/`makeCookie`/`verifySpaceCookie` remain pure and importable in vitest; `currentSpace` uses `next/headers` and is exercised at runtime, not in unit tests.)

- [ ] **Step 4: Commit**

```bash
git add lib/spaces.ts lib/auth.ts
git commit -m "feat: derive current space from cookie, delegate auth to it"
```

---

## Task 4: Login route + middleware use space cookie

**Files:**
- Modify: `app/api/auth/route.ts`
- Modify: `middleware.ts`

**Interfaces:**
- Consumes: `parseSpaces`, `spaceForPassword`, `makeCookie`, `verifySpaceCookie`, `AUTH_COOKIE` (Task 1–2)
- Produces: no new exports (behavior change only)

- [ ] **Step 1: Rewrite `app/api/auth/route.ts`**

Replace the ENTIRE contents with:

```ts
import { NextResponse } from 'next/server'
import { parseSpaces, spaceForPassword, makeCookie, AUTH_COOKIE } from '@/lib/spaces'

export async function POST(req: Request) {
  const { password } = await req.json() as { password?: string }
  const spaces = parseSpaces(process.env.SPACES)
  const name = password ? spaceForPassword(password, spaces) : null
  if (!name) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(AUTH_COOKIE, await makeCookie(name, spaces.get(name)!), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(AUTH_COOKIE)
  return res
}
```

- [ ] **Step 2: Rewrite `middleware.ts`**

Replace the ENTIRE contents with:

```ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifySpaceCookie, parseSpaces, AUTH_COOKIE } from '@/lib/spaces'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(AUTH_COOKIE)?.value
  const space = await verifySpaceCookie(token, parseSpaces(process.env.SPACES))
  const authed = space !== null

  if (pathname.startsWith('/login')) {
    if (authed) return NextResponse.redirect(new URL('/', request.url))
    return NextResponse.next()
  }

  if (!authed) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon).*)'],
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/route.ts middleware.ts
git commit -m "feat: login maps password to space; middleware validates space cookie"
```

---

## Task 5: Schema — `session.space` column + migration

**Files:**
- Modify: `schema.sql`

**Interfaces:** none (DB schema).

- [ ] **Step 1: Add `space` to the `session` table definition in `schema.sql`**

In the `create table if not exists session (...)` block, add the `space` column immediately after the `id` line:

```sql
  id            uuid primary key default gen_random_uuid(),
  space         text not null,
  date          date not null,
```

- [ ] **Step 2: Add the space index near the other `create index` lines in `schema.sql`**

```sql
create index if not exists idx_session_space on session(space);
```

- [ ] **Step 3: Add a commented migration block at the END of `schema.sql`**

```sql
-- ── Migration for an existing DB that already has session rows ────
-- Run these three statements INSTEAD of recreating the table, then
-- replace '<默认空间名>' with the space your existing data belongs to
-- (must match a name configured in the SPACES env var).
--
-- alter table session add column if not exists space text;
-- update session set space = '<默认空间名>' where space is null;
-- alter table session alter column space set not null;
-- create index if not exists idx_session_space on session(space);
```

- [ ] **Step 4: Apply to Supabase (manual)**

For a fresh DB: re-run the full `schema.sql` in Supabase SQL Editor.
For an existing DB with data: run the three uncommented migration statements from Step 3 with `<默认空间名>` filled in.
Expected: `session` has a non-null `space` column and `idx_session_space` index.

- [ ] **Step 5: Commit**

```bash
git add schema.sql
git commit -m "feat: add space column and index to session table"
```

---

## Task 6: Inject space filter into reads (`lib/queries.ts`)

**Files:**
- Modify: `lib/queries.ts`

**Interfaces:**
- Consumes: `requireSpace` (Task 3)

- [ ] **Step 1: Add the import at the top of `lib/queries.ts`**

```ts
import { requireSpace } from './spaces'
```

- [ ] **Step 2: Add `.eq('space', space)` to each of the 7 session reads**

For each function below, add `const space = await requireSpace()` as its first line, then chain `.eq('space', space)` onto the `db.from('session')...` query.

`getLeaderboardSessions` (~L68):
```ts
export async function getLeaderboardSessions(): Promise<LeaderboardSessionRow[]> {
  const space = await requireSpace()
  const { data: sessions } = await db
    .from('session')
    .select('id, date, exchange_rate')
    .eq('space', space)
    .is('deleted_at', null)
    .eq('status', 'SETTLED')
    .order('date', { ascending: true })
```

`getSessionsList` (~L101):
```ts
export async function getSessionsList(): Promise<SessionRow[]> {
  const space = await requireSpace()
  const { data: sessions } = await db
    .from('session')
    .select('id, date, description, exchange_rate, status, started_at')
    .eq('space', space)
    .is('deleted_at', null)
```

`getSessionStatus` (~L153):
```ts
export async function getSessionStatus(id: string): Promise<string | null> {
  const space = await requireSpace()
  const { data } = await db.from('session').select('status').eq('id', id).eq('space', space).is('deleted_at', null).single()
  return data?.status ?? null
}
```

`getSessionDetail` (~L158) — the session query inside `Promise.all`:
```ts
  const space = await requireSpace()
  const [{ data: session }, { data: parts }, { data: buyins }, names] = await Promise.all([
    db.from('session').select('id, date, description, exchange_rate, status').eq('id', id).eq('space', space).is('deleted_at', null).single(),
```

`getSessionForEdit` (~L199):
```ts
  const space = await requireSpace()
  const [{ data: session }, { data: parts }, { data: buyins }, names] = await Promise.all([
    db.from('session').select('date, exchange_rate, description, status').eq('id', id).eq('space', space).is('deleted_at', null).single(),
```

`getLiveSession` (~L244):
```ts
  const space = await requireSpace()
  const [{ data: session }, { data: parts }, { data: buyins }, names] = await Promise.all([
    db.from('session').select('id, date, description, exchange_rate, buy_in_unit, started_at, status').eq('id', id).eq('space', space).is('deleted_at', null).single(),
```

`getPlayerDetail` (~L291) — only the second session query (~L301) gets the filter; the participant lookup at ~L295 stays unchanged (cross-space participations are dropped once the session query filters by space):
```ts
export async function getPlayerDetail(id: string): Promise<PlayerDetail | null> {
  const space = await requireSpace()
  // ... player + myParts fetch unchanged ...
  const { data: sessions } = await db
    .from('session')
    .select('id, date, description, exchange_rate')
    .eq('space', space)
    .is('deleted_at', null)
    .eq('status', 'SETTLED')
    .in('id', mySessionIds)
```

Do NOT add `space` to `getPlayers`, `playerNameMap`, `resultsBySession`, or any `session_participant`/`buy_in` query.

- [ ] **Step 3: Verify types compile and existing tests pass**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all existing tests green.

- [ ] **Step 4: Commit**

```bash
git add lib/queries.ts
git commit -m "feat: scope session reads to the current space"
```

---

## Task 7: Inject space into writes + ownership guard (`lib/mutations.ts`)

**Files:**
- Modify: `lib/mutations.ts`

**Interfaces:**
- Consumes: `requireSpace` (Task 3), `ApiError` (existing)
- Produces (internal): `async function requireSessionInSpace(id: string): Promise<void>`

- [ ] **Step 1: Add the import at the top of `lib/mutations.ts`**

```ts
import { requireSpace } from './spaces'
```

- [ ] **Step 2: Make `requireOpenSession` space-aware and add `requireSessionInSpace`**

Replace the existing `requireOpenSession` function (~L19-23) with:

```ts
async function requireOpenSession(id: string): Promise<void> {
  const space = await requireSpace()
  const { data: session } = await db.from('session').select('status').eq('id', id).eq('space', space).single()
  if (!session) throw new ApiError(404, 'Session not found')
  if (session.status !== 'OPEN') throw new ApiError(409, 'Session is not open')
}

// Guard: the session must belong to the caller's current space. Call this
// FIRST in any mutation that writes by session id, before any update/delete,
// to prevent cross-space writes via a guessed id.
async function requireSessionInSpace(id: string): Promise<void> {
  const space = await requireSpace()
  const { data } = await db.from('session').select('id').eq('id', id).eq('space', space).single()
  if (!data) throw new ApiError(404, 'Session not found')
}
```

- [ ] **Step 3: Inject `space` into `importSession`'s session insert (~L78)**

```ts
export async function importSession(meta: SessionMeta, entries: ImportEntry[]) {
  const space = await requireSpace()
  const { data: session, error } = await db
    .from('session')
    .insert({
      space,
      date: meta.date,
      exchange_rate: meta.exchange_rate,
      description: meta.description || null,
      status: 'SETTLED',
      buy_in_unit: BUY_IN_UNIT,
    })
    .select()
    .single()
```

- [ ] **Step 4: Inject `space` into `startSession`'s session insert (~L118)**

```ts
export async function startSession(meta: SessionMeta, players: StartingPlayer[]) {
  if (players.length === 0) throw new ApiError(400, 'At least one player required')
  for (const p of players) {
    if (!p.player_id) throw new ApiError(400, 'player_id required')
    if (!Number.isInteger(p.initial_buyin) || p.initial_buyin < 0) {
      throw new ApiError(400, 'initial_buyin must be a non-negative integer')
    }
  }
  const space = await requireSpace()
  const { data: session, error } = await db
    .from('session')
    .insert({
      space,
      date: meta.date,
      exchange_rate: meta.exchange_rate ?? 40,
      description: meta.description || null,
      status: 'OPEN',
      buy_in_unit: BUY_IN_UNIT,
      started_at: now(),
    })
    .select()
    .single()
```

- [ ] **Step 5: Guard `updateSettledSession` before its write batch (~L168)**

Add `await requireSessionInSpace(id)` as the FIRST statement inside `updateSettledSession`, before the participant validation loop:

```ts
export async function updateSettledSession(
  id: string,
  meta: SessionMeta,
  participants: EditedParticipant[],
  force: boolean,
): Promise<{ id: string; diff: number }> {
  await requireSessionInSpace(id)
  if (!participants || participants.length === 0) {
    throw new ApiError(400, 'At least one player required')
  }
```

- [ ] **Step 6: Guard `softDeleteSession` (~L231)**

```ts
export async function softDeleteSession(id: string): Promise<void> {
  await requireSessionInSpace(id)
  const ts = now()
  const { error } = await db
    .from('session')
    .update({ deleted_at: ts, updated_at: ts })
    .eq('id', id)
  ensure(error)
}
```

- [ ] **Step 7: Guard `removeParticipant` (~L254)**

```ts
export async function removeParticipant(sessionId: string, playerId: string): Promise<void> {
  if (!playerId) throw new ApiError(400, 'player_id required')
  await requireSessionInSpace(sessionId)
  const ts = now()
  const [{ error: pErr }, { error: bErr }] = await Promise.all([
```

(`addParticipant` and `addBuyin` need no change: both call the now-space-aware `requireOpenSession`. `createPlayer`/`renamePlayer` unchanged — players are global.)

- [ ] **Step 8: Verify types compile and existing tests pass**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all existing tests green.

- [ ] **Step 9: Commit**

```bash
git add lib/mutations.ts
git commit -m "feat: scope session writes to current space and guard cross-space writes"
```

---

## Task 8: Env docs + full verification

**Files:**
- Modify: `.env.example`

**Interfaces:** none.

- [ ] **Step 1: Update `.env.example`**

Replace the `SHARED_PASSWORD` block with the `SPACES` block:

```
# Supabase (server-side only, never exposed to browser)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Spaces: one game per entry as name:password, comma-separated.
# Logging in with a space's password scopes all data to that space.
# Names and passwords must not contain ',' or ':'.
SPACES=游戏A:密码A,游戏B:密码B
```

- [ ] **Step 2: Full build + test + typecheck**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean; all tests pass; `next build` succeeds.

- [ ] **Step 3: Manual verification checklist** (DB-layer isolation has no automated test — matches this repo's convention of not testing DB code)

Set `SPACES=游戏A:pa,游戏B:pb` locally, run `npm run dev`, then confirm:
- [ ] Login with `pa` → create a session with players → it appears in the list/leaderboard.
- [ ] Log out (or clear cookie), login with `pb` → the 游戏A session is NOT visible; leaderboard empty.
- [ ] While in 游戏B, opening the 游戏A session's URL (`/sessions/<A-id>`) → not-found / no data.
- [ ] Attempting to delete/edit the 游戏A session while in 游戏B → 404, 游戏A data unchanged after switching back to `pa`.
- [ ] Same player name created in 游戏A also appears in 游戏B's player picker (players are global), but their detail page shows only current-space results.
- [ ] `SPACES` unset → login with any/empty password → 401; POST `/api/auth` with empty body → 401 (old bypass fixed).

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "docs: document SPACES env for multi-space login"
```

---

## Self-Review Notes

- **Spec coverage:** §2 selection → Task 1,4. §3 architecture (spaces.ts/auth/middleware/route) → Task 1–4. §4.1 schema → Task 5. §4.2 reads → Task 6. §4.3 writes+guard → Task 7. §5 security (per-space key, guard, bypass fix) → Task 2,4,7. §6 file list → all tasks. §7 tests → Task 1,2 (unit) + Task 8 (manual, per repo convention). §8 YAGNI honored (login page untouched, no space column on player/participant/buy_in).
- **Type consistency:** `requireSpace(): Promise<string>`, `currentSpace(): Promise<string|null>`, `verifySpaceCookie(value, spaces): Promise<string|null>`, `makeCookie(name, password): Promise<string>`, `spaceForPassword(pw, spaces): string|null`, `parseSpaces(raw): Map<string,string>`, `requireSessionInSpace(id): Promise<void>` — used consistently across Tasks 1–7.
- **Known limitation (documented in spec §5):** isolation is enforced in the app layer, not Supabase RLS; the anon key is a shared secret.
