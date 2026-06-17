import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { estimateTaskMinutes } from '@/lib/claude'
import { emitTaskEvent, type TaskEventPayload } from '@/lib/events'
import { getTodayPKT } from '@/lib/utils'
import { sendWhatsAppMessage, toChatId } from '@/lib/greenapi'
import {
  TASK_INCLUDE,
  enrichTasksWithAssignees,
  resolveTaskAssignees,
} from '@/lib/task-assignees'

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

function memberTeamKey(m: { team?: string | null; department: string }): string {
  return (m.team || m.department || '').toUpperCase()
}

async function resolveAssigneeIds(body: {
  team_member_id?: string | number
  team_member_ids?: Array<string | number>
  team_target?: string
}): Promise<{ ids: number[]; assignedTeam: string | null }> {
  if (body.team_member_ids?.length) {
    const ids = body.team_member_ids.map(id => parseInt(String(id), 10)).filter(id => !isNaN(id))
    if (!ids.length) throw new Error('No valid assignees')
    const assignedTeam = body.team_target?.trim().toUpperCase() || null
    return { ids, assignedTeam }
  }

  if (body.team_target) {
    const members = await prisma.teamMember.findMany({ orderBy: { name: 'asc' } })
    const team = body.team_target.trim().toUpperCase()
    const ids = members
      .filter(m => memberTeamKey(m) === team)
      .map(m => m.id)
    if (!ids.length) throw new Error(`No members found for team ${body.team_target}`)
    return { ids, assignedTeam: team }
  }

  if (body.team_member_id) {
    const id = parseInt(String(body.team_member_id), 10)
    if (isNaN(id)) throw new Error('Invalid assignee')
    return { ids: [id], assignedTeam: null }
  }

  throw new Error('Missing assignee')
}

function serializeTask(task: {
  id: number
  team_member_id: number | null
  assigned_team: string | null
  message_text: string
  date: string
  estimated_minutes: number | null
  created_at: Date
  team_member: TaskEventPayload['task']['team_member']
  assignees?: TaskEventPayload['task']['assignees']
}): TaskEventPayload['task'] {
  return {
    id: task.id,
    team_member_id: task.team_member_id,
    assigned_team: task.assigned_team,
    message_text: task.message_text,
    date: task.date,
    estimated_minutes: task.estimated_minutes,
    created_at: task.created_at.toISOString(),
    team_member: task.team_member,
    assignees: task.assignees,
  }
}

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
      const id = parseInt(memberId, 10)
      where.OR = [
        { team_member_id: id },
        { assignee_ids: { has: id } },
      ]
    }
    if (search) where.message_text = { contains: search, mode: 'insensitive' }

    const tasks = await prisma.task.findMany({
      where,
      include: { ...TASK_INCLUDE, notes: { orderBy: { created_at: 'asc' } } },
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json(await enrichTasksWithAssignees(tasks))
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { assigned_by_id, message_text, date, reminder_interval_minutes } = body

    if (!message_text?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let assigneeIds: number[]
    let assignedTeam: string | null
    try {
      const resolved = await resolveAssigneeIds(body)
      assigneeIds = resolved.ids
      assignedTeam = resolved.assignedTeam
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Invalid assignees' }, { status: 400 })
    }

    const taskDate = date || getTodayPKT()
    const isTeamTask = assigneeIds.length > 1 || !!assignedTeam

    const task = await prisma.task.create({
      data: {
        team_member_id: isTeamTask ? null : assigneeIds[0],
        assigned_team: assignedTeam,
        assignee_ids: assigneeIds,
        assigned_by_id: assigned_by_id ? parseInt(assigned_by_id, 10) : null,
        message_text: message_text.trim(),
        date: taskDate,
        estimated_minutes: null,
        reminder_interval_minutes: reminder_interval_minutes ? parseInt(reminder_interval_minutes, 10) : null,
      },
      include: TASK_INCLUDE,
    })

    const [enriched] = await enrichTasksWithAssignees([task])
    const assignees = resolveTaskAssignees(enriched)
    const assignerName = enriched.assigned_by?.name ?? 'Admin'
    const reminderNote = reminder_interval_minutes
      ? `\n⏰ You'll be reminded ${REMINDER_LABELS[reminder_interval_minutes] ?? `every ${reminder_interval_minutes} min`}.`
      : ''

    getGreenAPISettings().then(async (settings) => {
      if (!settings) return
      await Promise.all(assignees.map(assignee => {
        const msg = `📌 New task assigned to you by *${assignerName}*:\n\n"${message_text.trim()}"${reminderNote}\n\n🔗 https://qc-dashboard-q907.onrender.com`
        return sendWhatsAppMessage(settings.instanceId, settings.token, toChatId(assignee.whatsapp_number), msg, settings.apiUrl)
      }))
    }).catch(console.error)

    estimateTaskMinutes(message_text.trim()).then(async (minutes) => {
      const updated = await prisma.task.update({
        where: { id: task.id },
        data: { estimated_minutes: minutes },
        include: TASK_INCLUDE,
      })
      const [enrichedUpdated] = await enrichTasksWithAssignees([updated])
      emitTaskEvent({ type: 'task_updated', task: serializeTask(enrichedUpdated) })
    }).catch(console.error)

    emitTaskEvent({ type: 'new_task', task: serializeTask(enriched) })

    return NextResponse.json(enriched, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
