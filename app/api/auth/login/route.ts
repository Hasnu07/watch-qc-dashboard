import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

function hashPassword(username: string, password: string) {
  return crypto.createHash('sha256').update(`${username}:${password}:qc-salt`).digest('hex')
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    const [userRow, hashRow] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'admin_username' } }),
      prisma.setting.findUnique({ where: { key: 'admin_password_hash' } }),
    ])

    const expectedHash = hashPassword(username, password)
    const usernameMatch = userRow?.value?.toLowerCase() === username.toLowerCase()
    const passwordMatch = hashRow?.value === expectedHash

    if (!usernameMatch || !passwordMatch) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    // Generate session token, persist it
    const token = crypto.randomBytes(32).toString('hex')
    await prisma.setting.upsert({
      where: { key: 'admin_session_token' },
      update: { value: token },
      create: { key: 'admin_session_token', value: token },
    })

    const res = NextResponse.json({ ok: true })
    res.cookies.set('qc_admin_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })
    return res
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
