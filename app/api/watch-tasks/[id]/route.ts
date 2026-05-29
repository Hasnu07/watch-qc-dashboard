import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitWatchTaskEvent } from '@/lib/events'
import { sendTaskCompletedNotification, TASK_LABELS, checkAndUnlockLocation } from '@/lib/watch-tasks'
import { logWatchActivity } from '@/lib/watch-activity'
import {
  canAssignWatchTask,
  canCompleteWatchTask,
  requireSession,
} from '@/lib/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireSession(req)
    if (session instanceof NextResponse) return session

    const id = parseInt(params.id, 10)
    const body = await req.json()

    const existing = await prisma.watchTask.findUnique({
      where: { id },
      include: {
        watch: { select: { id: true, name: true, brand: true, model: true, payment_status: true } },
      },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if ('assigned_to' in body && !canAssignWatchTask(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const mutatesTask =
      body.is_completed !== undefined ||
      body.metadata !== undefined ||
      body.is_locked !== undefined

    if (mutatesTask && !canCompleteWatchTask(session, existing)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {}
    if (body.is_completed !== undefined) {
      data.is_completed = body.is_completed
      data.completed_at = body.is_completed ? new Date() : null
      data.completed_by = body.is_completed ? session.name : null
    }
    if (body.is_locked !== undefined) data.is_locked = body.is_locked
    if (body.metadata !== undefined) data.metadata = body.metadata
    if ('assigned_to' in body) data.assigned_to = body.assigned_to || null

    const task = await prisma.watchTask.update({
      where: { id },
      data,
      include: {
        watch: { select: { id: true, name: true, brand: true, model: true, payment_status: true } },
      },
    })

    if (body.metadata) {
      if (body.metadata.logistics_cost !== undefined) {
        await prisma.watch.update({
          where: { id: task.watch_id },
          data: {
            logistics_cost: body.metadata.logistics_cost ? parseFloat(String(body.metadata.logistics_cost)) : null,
            logistics_cost_currency: body.metadata.logistics_cost_currency || 'USD',
          },
        })
      }
      if (body.metadata.website_price !== undefined || body.metadata.b2b_price !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const priceData: any = {}
        if (body.metadata.website_price) priceData.website_price = parseFloat(String(body.metadata.website_price))
        if (body.metadata.b2b_price) priceData.b2b_price = parseFloat(String(body.metadata.b2b_price))
        if (Object.keys(priceData).length > 0) {
          await prisma.watch.update({ where: { id: task.watch_id }, data: priceData })
        }
      }
      if (task.task_type === 'ACCOUNTING_MARK_PAYMENT' && body.metadata.payment_status) {
        await prisma.watch.update({
          where: { id: task.watch_id },
          data: { payment_status: body.metadata.payment_status },
        })
        checkAndUnlockLocation(task.watch_id).catch(console.error)
      }
      if (task.task_type === 'LOGISTICS_SET_LOCATION') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const locData: any = {}
        if (body.metadata.location_status) locData.location_status = body.metadata.location_status
        if (body.metadata.location_from !== undefined) locData.location_from = body.metadata.location_from || null
        if (body.metadata.location_to !== undefined) locData.location_to = body.metadata.location_to || null
        if (body.metadata.location_status === 'IN_STOCK') locData.received_date = new Date()
        if (Object.keys(locData).length > 0) {
          await prisma.watch.update({ where: { id: task.watch_id }, data: locData })
        }
      }
    }

    if (body.is_completed === true) {
      emitWatchTaskEvent({
        type: 'task_completed',
        watch_task_id: task.id,
        watch_id: task.watch_id,
        department: task.department,
        task_type: task.task_type,
      })
      const watchName = [task.watch.brand, task.watch.model].filter(Boolean).join(' ') || task.watch.name
      const taskLabel = TASK_LABELS[task.task_type] ?? task.task_type
      logWatchActivity(task.watch_id, 'task_completed', taskLabel, session.name).catch(console.error)
      sendTaskCompletedNotification(task.assigned_to, watchName, taskLabel).catch(console.error)
    } else if (body.is_completed === false || body.metadata) {
      emitWatchTaskEvent({
        type: 'task_updated',
        watch_task_id: task.id,
        watch_id: task.watch_id,
        metadata: body.metadata,
      })
    }

    return NextResponse.json(task)
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}
