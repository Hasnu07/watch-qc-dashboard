import { NextRequest, NextResponse } from 'next/server'
import {
  clearSessionCookie,
  destroySession,
  getSessionToken,
} from '@/lib/auth'

export async function POST(req: NextRequest) {
  await destroySession(getSessionToken(req))
  const res = NextResponse.json({ ok: true })
  clearSessionCookie(res)
  return res
}
