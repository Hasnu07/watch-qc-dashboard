import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await req.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {}
    if (body.is_completed !== undefined) {
      data.is_completed = body.is_completed
      data.completed_at = body.is_completed ? new Date() : null
    }
    if (body.message_text !== undefined) data.message_text = body.message_text
    if (body.reminder_interval_minutes !== undefined) data.reminder_interval_minutes = body.reminder_interval_minutes

    const task = await prisma.task.update({ where: { id }, data, include: { team_member: true } })
    return NextResponse.json(task)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    await prisma.task.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
