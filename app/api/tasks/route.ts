import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { estimateTaskMinutes } from '@/lib/claude'
import { emitTaskEvent } from '@/lib/events'
import { getTodayPKT } from '@/lib/utils'
import { sendWhatsAppMessage, toChatId } from '@/lib/greenapi'

export const dynamic = 'force-dynamic'

async function getGreenAPISettings() {
  const [inst, tok, url] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'greenapi_instance_id' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_token' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_url' } }),
  ])
  if (!inst?.value || !tok?.value) return null
  return { instanceId: inst.value, token: tok.value, apiUrl: url?.value || 'https://api.green-api.com' }
}

const REMINDER_LABELS: Record<number, string> = {
  60: 'every 60 minutes',
  180: 'every 3 hours',
  1440: 'every 24 hours',
}

const INCLUDE_FULL = { team_member: true, assigned_by: true }

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
    if (memberId) where.team_member_id = parseInt(memberId, 10)
    if (search) where.message_text = { contains: search, mode: 'insensitive' }

    const tasks = await prisma.task.findMany({
      where,
      include: INCLUDE_FULL,
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
    const { team_member_id, assigned_by_id, message_text, date, reminder_interval_minutes } = body

    if (!team_member_id || !message_text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const taskDate = date || getTodayPKT()

    const task = await prisma.task.create({
      data: {
        team_member_id: parseInt(team_member_id, 10),
        assigned_by_id: assigned_by_id ? parseInt(assigned_by_id, 10) : null,
        message_text,
        date: taskDate,
        estimated_minutes: null,
        reminder_interval_minutes: reminder_interval_minutes ? parseInt(reminder_interval_minutes, 10) : null,
      },
      include: INCLUDE_FULL,
    })

    // Notify the assignee via WhatsApp
    getGreenAPISettings().then(async (settings) => {
      if (!settings) return
      const assignerName = task.assigned_by?.name ?? 'Admin'
      const reminderNote = reminder_interval_minutes
        ? `\n⏰ You'll be reminded ${REMINDER_LABELS[reminder_interval_minutes] ?? `every ${reminder_interval_minutes} min`}.`
        : ''
      const msg = `📌 New task assigned to you by *${assignerName}*:\n\n"${message_text}"${reminderNote}\n\n🔗 https://qc-dashboard-q907.onrender.com`
      await sendWhatsAppMessage(settings.instanceId, settings.token, toChatId(task.team_member.whatsapp_number), msg, settings.apiUrl)
    }).catch(console.error)

    estimateTaskMinutes(message_text).then(async (minutes) => {
      const updated = await prisma.task.update({
        where: { id: task.id },
        data: { estimated_minutes: minutes },
        include: INCLUDE_FULL,
      })
      emitTaskEvent({ type: 'task_updated', task: { ...updated, created_at: updated.created_at.toISOString() } })
    }).catch(console.error)

    emitTaskEvent({ type: 'new_task', task: { ...task, created_at: task.created_at.toISOString() } })

    return NextResponse.json(task, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
