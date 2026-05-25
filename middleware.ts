import { NextRequest, NextResponse } from 'next/server'

// Routes that require a logged-in admin. Mirrors the matcher below so the
// intent is clear in one place. The root '/' (Admin Tasks) is intentionally
// public so the team can read assigned tasks without signing in.
const PROTECTED = ['/dashboard', '/history', '/settings']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Always allow Next internals, the login page, and the auth API
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/login' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const isProtected = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (isProtected) {
    const token = req.cookies.get('qc_admin_session')?.value
    if (!token) {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      // Remember where the user was heading so we can return them after login
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
