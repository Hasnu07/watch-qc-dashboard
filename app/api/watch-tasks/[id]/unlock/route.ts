import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitWatchTaskEvent } from '@/lib/events'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    const task = await prisma.watchTask.update({
      where: { id },
      data: { is_locked: false },
    })
    emitWatchTaskEvent({ type: 'task_unlocked', watch_task_id: task.id, watch_id: task.watch_id })
    return NextResponse.json(task)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to unlock task' }, { status: 500 })
  }
}
