import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  createSession,
  hashPassword,
  setSessionCookie,
} from '@/lib/auth'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    const member = await prisma.teamMember.findFirst({
      where: { login_username: { equals: username, mode: 'insensitive' } },
    })

    if (!member || !member.password_hash) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    const expectedHash = hashPassword(member.login_username ?? member.name, password)
    if (member.password_hash !== expectedHash) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
    }

    const { token } = await createSession(member.id)

    const res = NextResponse.json({
      ok: true,
      member: { id: member.id, name: member.name, role: member.role },
    })
    setSessionCookie(res, token)
    return res
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
