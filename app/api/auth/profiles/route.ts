import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Public list for login profile picker — no secrets. */
export async function GET() {
  try {
    const members = await prisma.teamMember.findMany({
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        department: true,
        role: true,
        login_username: true,
      },
    })
    return NextResponse.json(members)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load profiles' }, { status: 500 })
  }
}
