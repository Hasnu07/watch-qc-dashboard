import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWhatsAppMessage, toChatId } from '@/lib/greenapi'
import {
  TASK_INCLUDE,
  enrichTasksWithAssignees,
  resolveTaskAssignees,
} from '@/lib/task-assignees'

async function getGreenAPISettings() {
  const [inst, tok, url] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'greenapi_instance_id' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_token' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_url' } }),
  ])
  if (!inst?.value || !tok?.value) return null
  return { instanceId: inst.value, token: tok.value, apiUrl: url?.value || 'https://api.green-api.com' }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id, 10)
    const body = await req.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {}
    if (body.is_completed !== undefined) {
      data.is_completed = body.is_completed
      data.completed_at = body.is_completed ? new Date() : null
      data.completed_by = body.is_completed
        ? (body.completed_by?.trim() || null)
        : null
    }
    if (body.message_text !== undefined) data.message_text = body.message_text
    if (body.reminder_interval_minutes !== undefined) data.reminder_interval_minutes = body.reminder_interval_minutes

    const task = await prisma.task.update({
      where: { id },
      data,
      include: TASK_INCLUDE,
    })

    const [enriched] = await enrichTasksWithAssignees([task])

    if (body.is_completed && enriched.assigned_by?.whatsapp_number) {
      const assignees = resolveTaskAssignees(enriched)
      const completerName = enriched.completed_by
        || (assignees.length === 1 ? assignees[0].name : 'Team')
      getGreenAPISettings().then(async (settings) => {
        if (!settings) return
        const msg = `✅ Task completed!\n\n*${completerName}* has completed the task assigned by you:\n\n"${enriched.message_text}"\n\n🔗 https://qc-dashboard-q907.onrender.com`
        await sendWhatsAppMessage(settings.instanceId, settings.token, toChatId(enriched.assigned_by!.whatsapp_number), msg, settings.apiUrl)
      }).catch(console.error)
    }

    return NextResponse.json(enriched)
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
