import { NextResponse } from 'next/server'
import { generateToken, AUTH_COOKIE } from '@/lib/auth'
import { parsePasswordCommand, readCommand } from '@/lib/commands'
import { withErrorHandling } from '@/lib/http'

export const POST = withErrorHandling(async req => {
  const { password } = await readCommand(req, parsePasswordCommand)
  if (password !== process.env.SHARED_PASSWORD) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(AUTH_COOKIE, await generateToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return res
})

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(AUTH_COOKIE)
  return res
}
