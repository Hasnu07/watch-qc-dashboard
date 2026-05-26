import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendWhatsAppMessage, toChatId } from '@/lib/greenapi'

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
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const taskId = parseInt(params.id, 10)
    if (isNaN(taskId)) return NextResponse.json({ error: 'Invalid task id' }, { status: 400 })

    const body = await req.json()
    const reason: string = (body.reason ?? '').trim()
    if (!reason) return NextResponse.json({ error: 'Reason is required' }, { status: 400 })

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { team_member: true, assigned_by: true },
    })
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

    // Must have an assigner to notify
    if (!task.assigned_by) {
      return NextResponse.json({ error: 'No assigner to notify' }, { status: 400 })
    }

    const settings = await getGreenAPISettings()
    if (!settings) return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 503 })

    const message =
      `❌ *Task Not Completed*\n\n` +
      `📋 Task: _"${task.message_text}"_\n` +
      `👤 Reported by: *${task.team_member.name}*\n\n` +
      `📝 *Reason:*\n${reason}\n\n` +
      `🔗 View on dashboard:\nhttps://qc-dashboard-q907.onrender.com/`

    const sent = await sendWhatsAppMessage(
      settings.instanceId,
      settings.token,
      toChatId(task.assigned_by.whatsapp_number),
      message,
      settings.apiUrl
    )

    if (!sent) return NextResponse.json({ error: 'Failed to send WhatsApp message' }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
