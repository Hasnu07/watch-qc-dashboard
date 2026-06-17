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

    // Notify all assignees via WhatsApp
    const [enriched] = await enrichTasksWithAssignees([task])
    const assignees = resolveTaskAssignees(enriched)

    if (assignees.length > 0) {
      getGreenAPISettings().then(async (settings) => {
        if (!settings) return
        const fromLine = author ? `\n\nFrom: *${author}*` : ''
        const msg = `📝 Note on your task:\n\n*"${enriched.message_text}"*${fromLine}\n\n${text}\n\n🔗 ${APP_LINK}`
        await Promise.allSettled(
          assignees.map(a =>
            sendWhatsAppMessage(settings.instanceId, settings.token, toChatId(a.whatsapp_number), msg, settings.apiUrl)
          )
        )
      }).catch(console.error)
    }

    return NextResponse.json(note, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 })
  }
}
