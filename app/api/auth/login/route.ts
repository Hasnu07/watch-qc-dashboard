import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  createSession,
  setSessionCookie,
} from '@/lib/auth'
import { seedMemberLogins, verifyMemberPassword } from '@/lib/seed-member-logins'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()
    if (!username || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    // Ensure passwords exist (Render build seed may not reach the DB)
    await seedMemberLogins().catch(err => console.error('[Login] seed failed:', err))

    const trimmed = String(username).trim()
    let member = await prisma.teamMember.findFirst({
      where: {
        OR: [
          { login_username: { equals: trimmed, mode: 'insensitive' } },
          { name: { equals: trimmed, mode: 'insensitive' } },
        ],
      },
    })

    if (!member || !verifyMemberPassword(member, password)) {
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
