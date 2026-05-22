import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { estimateTaskMinutes } from '@/lib/claude'
import { emitTaskEvent } from '@/lib/events'
import { getTodayPKT } from '@/lib/utils'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const todayOnly = searchParams.get('today') === 'true'
    const memberId = searchParams.get('member_id')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const search = searchParams.get('search')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (todayOnly && !dateFrom && !dateTo) {
      where.date = getTodayPKT()
    } else if (dateFrom || dateTo) {
      where.date = {}
      if (dateFrom) where.date.gte = dateFrom
      if (dateTo) where.date.lte = dateTo
    }
    if (memberId) {
      where.team_member_id = parseInt(memberId, 10)
    }
    if (search) {
      where.message_text = { contains: search, mode: 'insensitive' }
    }

    const tasks = await prisma.task.findMany({
      where,
      include: { team_member: true },
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json(tasks)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { team_member_id, message_text, date } = body

    if (!team_member_id || !message_text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const taskDate = date || getTodayPKT()

    // Create task first with null estimated_minutes
    const task = await prisma.task.create({
      data: {
        team_member_id: parseInt(team_member_id, 10),
        message_text,
        date: taskDate,
        estimated_minutes: null,
      },
      include: { team_member: true },
    })

    // Estimate time asynchronously, then update and emit
    estimateTaskMinutes(message_text).then(async (minutes) => {
      const updated = await prisma.task.update({
        where: { id: task.id },
        data: { estimated_minutes: minutes },
        include: { team_member: true },
      })
      emitTaskEvent({
        type: 'task_updated',
        task: {
          ...updated,
          estimated_minutes: updated.estimated_minutes,
          created_at: updated.created_at.toISOString(),
          team_member: updated.team_member,
        },
      })
    })

    emitTaskEvent({
      type: 'new_task',
      task: {
        ...task,
        estimated_minutes: task.estimated_minutes,
        created_at: task.created_at.toISOString(),
        team_member: task.team_member,
      },
    })

    return NextResponse.json(task, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
