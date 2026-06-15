import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWhatsAppMessage, toChatId } from '@/lib/greenapi'
import { TASK_INCLUDE, resolveTaskAssignees } from '@/lib/task-assignees'

async function getGreenAPISettings() {
  const [inst, tok, url] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'greenapi_instance_id' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_token' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_url' } }),
  ])
  if (!inst?.value || !tok?.value) return null
  return { instanceId: inst.value, token: tok.value, apiUrl: url?.value || 'https://api.green-api.com' }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = parseInt(params.id, 10)
    if (isNaN(taskId)) return NextResponse.json({ error: 'Invalid task id' }, { status: 400 })

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: TASK_INCLUDE,
    })
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    const assignees = resolveTaskAssignees(task)
    if (!assignees.length) return NextResponse.json({ error: 'No assignees found' }, { status: 400 })

    const settings = await getGreenAPISettings()
    if (!settings) return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 503 })

    const ringerName = task.assigned_by?.name ?? 'Admin'

    const message =
      `🔔 You have been ringed by *${ringerName}*\n\n` +
      `Tell the reason why your task is still on the dashboard.\n\n` +
      `*"${task.message_text}"*\n\n` +
      `If your task is done go on:\n` +
      `🔗 https://qc-dashboard-q907.onrender.com/\n` +
      `and click the ✅ check mark.\n\n` +
      `If you had any issues with the task kindly tell the reason.`

    const results = await Promise.all(assignees.map(assignee =>
      sendWhatsAppMessage(
        settings.instanceId,
        settings.token,
        toChatId(assignee.whatsapp_number),
        message,
        settings.apiUrl
      )
    ))

    if (!results.some(Boolean)) {
      return NextResponse.json({ error: 'Failed to send WhatsApp message' }, { status: 500 })
    }

    return NextResponse.json({ success: true, sent: results.filter(Boolean).length })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
