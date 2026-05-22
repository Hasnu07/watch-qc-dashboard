import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  await prisma.setting.deleteMany({ where: { key: 'admin_session_token' } }).catch(() => {})
  const res = NextResponse.json({ ok: true })
  res.cookies.set('qc_admin_session', '', { maxAge: 0, path: '/' })
  return res
}
