import { NextResponse } from 'next/server'
import { generateToken } from '@/lib/auth'

const COOKIE = 'chipindex_auth'

export async function POST(req: Request) {
  const { password } = await req.json() as { password: string }
  if (password !== process.env.SHARED_PASSWORD) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE, generateToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(COOKIE)
  return res
}
