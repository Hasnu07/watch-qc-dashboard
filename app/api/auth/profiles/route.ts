import { NextResponse } from 'next/server'
import { getProfileAvatarUrl } from '@/lib/profile-avatars'
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
    return NextResponse.json(
      members.map(member => ({
        ...member,
        avatar_url: getProfileAvatarUrl(member.name),
      })),
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to load profiles' }, { status: 500 })
  }
}
