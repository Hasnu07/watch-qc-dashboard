import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assignWatchTasks } from '@/lib/watch-tasks'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const watchId = parseInt(params.id, 10)
    const watch = await prisma.watch.findUnique({
      where: { id: watchId },
      select: { id: true, name: true, brand: true, model: true },
    })
    if (!watch) return NextResponse.json({ error: 'Watch not found' }, { status: 404 })

    const watchName = [watch.brand, watch.model].filter(Boolean).join(' ') || watch.name
    await assignWatchTasks(watchId, watchName)

    return NextResponse.json({ ok: true, watchName })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to assign tasks' }, { status: 500 })
  }
}
