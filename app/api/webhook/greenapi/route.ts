import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { estimateTaskMinutes } from '@/lib/claude'
import { emitTaskEvent } from '@/lib/events'
import { fromChatId } from '@/lib/greenapi'
import { getTodayPKT } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Only handle incoming text messages
    if (
      body.typeWebhook !== 'incomingMessageReceived' ||
      body.messageData?.typeMessage !== 'textMessage'
    ) {
      return NextResponse.json({ ok: true })
    }

    const chatId: string = body.senderData?.sender || body.senderData?.chatId || ''
    const messageText: string =
      body.messageData?.textMessageData?.textMessage || ''

    if (!chatId || !messageText) {
      return NextResponse.json({ ok: true })
    }

    // Extract phone number from chatId (e.g. "923001234567@c.us" -> "923001234567")
    const phoneNumber = fromChatId(chatId)

    // Match to a team member
    const member = await prisma.teamMember.findUnique({
      where: { whatsapp_number: phoneNumber },
    })

    if (!member) {
      console.log(`[Webhook] Unknown sender: ${phoneNumber}`)
      return NextResponse.json({ ok: true })
    }

    const today = getTodayPKT()

    // Save task
    const task = await prisma.task.create({
      data: {
        team_member_id: member.id,
        message_text: messageText,
        date: today,
        estimated_minutes: null,
      },
      include: { team_member: true },
    })

    console.log(`[Webhook] Task created for ${member.name}: "${messageText.slice(0, 50)}..."`)

    // Emit SSE event immediately (without estimated time)
    emitTaskEvent({
      type: 'new_task',
      task: {
        ...task,
        estimated_minutes: null,
        created_at: task.created_at.toISOString(),
        team_member: task.team_member,
      },
    })

    // Estimate time and update asynchronously
    estimateTaskMinutes(messageText).then(async (minutes) => {
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

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[Webhook] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
