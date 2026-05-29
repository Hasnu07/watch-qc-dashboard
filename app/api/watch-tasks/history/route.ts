import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest, watchTaskAssigneeFilter } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req)
    const tasks = await prisma.watchTask.findMany({
      where: session ? watchTaskAssigneeFilter(session) : {},
      include: {
        watch: { select: { id: true, name: true, brand: true, model: true } },
      },
      orderBy: [{ watch_id: 'asc' }, { id: 'asc' }],
    })
    return NextResponse.json(tasks)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch task history' }, { status: 500 })
  }
}
