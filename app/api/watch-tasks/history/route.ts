import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const tasks = await prisma.watchTask.findMany({
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
