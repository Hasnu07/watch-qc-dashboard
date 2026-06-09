import { NextResponse } from 'next/server'

// LOGIN REMOVED: the dashboard is fully open. No route is gated, nothing
// redirects to /login. (Kept as a pass-through so we can re-introduce auth
// later without re-wiring the matcher.)
export function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
