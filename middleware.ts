import { NextRequest, NextResponse } from 'next/server'

const LOGIN_REQUIRED = ['/dashboard', '/pending', '/history', '/settings']
const SESSION_COOKIE = 'qc_member_session'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/login' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const needsLogin = LOGIN_REQUIRED.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (!needsLogin) {
    return NextResponse.next()
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
