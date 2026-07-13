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
