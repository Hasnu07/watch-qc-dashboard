import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWhatsAppMessage, toChatId } from '@/lib/greenapi'
import { TASK_INCLUDE, enrichTasksWithAssignees, resolveTaskAssignees } from '@/lib/task-assignees'

const APP_LINK = 'https://qc-dashboard-q907.onrender.com'

async function getGreenAPISettings() {
  const [inst, tok, url] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'greenapi_instance_id' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_token' } }),
    prisma.setting.findUnique({ where: { key: 'greenapi_api_url' } }),
  ])
  if (!inst?.value || !tok?.value) return null
  return { instanceId: inst.value, token: tok.value, apiUrl: url?.value || 'https://api.green-api.com' }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const taskId = parseInt(params.id, 10)
    if (isNaN(taskId)) return NextResponse.json({ error: 'Invalid task id' }, { status: 400 })

    const body = await req.json()
    const text = body.text?.trim()
    const author = body.author?.trim() || null
    if (!text) return NextResponse.json({ error: 'Note text required' }, { status: 400 })

    const task = await prisma.task.findUnique({ where: { id: taskId }, include: TASK_INCLUDE })
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    const note = await prisma.taskNote.create({ data: { task_id: taskId, text, author } })

    // Notify the assigner (the person who gave out the task) via WhatsApp
    const [enriched] = await enrichTasksWithAssignees([task])
    const assigneeNames = resolveTaskAssignees(enriched).map(a => a.name).join(', ')

    if (task.assigned_by?.whatsapp_number) {
      getGreenAPISettings().then(async (settings) => {
        if (!settings) return
        const fromLine = author ? ` by *${author}*` : (assigneeNames ? ` by *${assigneeNames}*` : '')
        const msg = `📝 Note added${fromLine} on the task you assigned:\n\n*"${enriched.message_text}"*\n\n${text}\n\n🔗 ${APP_LINK}`
        await sendWhatsAppMessage(
          settings.instanceId,
          settings.token,
          toChatId(task.assigned_by!.whatsapp_number),
          msg,
          settings.apiUrl,
        )
      }).catch(console.error)
    }

    return NextResponse.json(note, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 })
  }
}
