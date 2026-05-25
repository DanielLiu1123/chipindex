import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { generateToken } from '@/lib/auth'

const COOKIE = 'chipindex_auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(COOKIE)?.value
  const expected = await generateToken()
  const authed = token === expected

  if (pathname.startsWith('/login')) {
    if (authed) return NextResponse.redirect(new URL('/', request.url))
    return NextResponse.next()
  }

  if (!authed) return NextResponse.redirect(new URL('/login', request.url))
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon).*)'],
}
