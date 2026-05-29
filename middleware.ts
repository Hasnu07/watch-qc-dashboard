import { NextRequest, NextResponse } from 'next/server'

const LOGIN_REQUIRED = ['/dashboard', '/pending', '/history']
const MASTER_ONLY = ['/settings']
const SESSION_COOKIE = 'qc_member_session'

export async function middleware(req: NextRequest) {
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
  const needsMaster = MASTER_ONLY.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (!needsLogin && !needsMaster) {
    return NextResponse.next()
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (needsLogin || needsMaster) {
    try {
      const meUrl = new URL('/api/auth/me', req.url)
      const meRes = await fetch(meUrl, {
        headers: { cookie: `${SESSION_COOKIE}=${token}` },
      })
      if (!meRes.ok) {
        const url = req.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('next', pathname)
        return NextResponse.redirect(url)
      }
      if (needsMaster) {
        const me = await meRes.json()
        if (me.role !== 'MASTER') {
          const url = req.nextUrl.clone()
          url.pathname = '/dashboard'
          return NextResponse.redirect(url)
        }
      }
    } catch {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
