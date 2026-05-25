import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { importWatchFromMessage } from '@/lib/import-watch-from-message'
import { trackGroup, logHit, type WebhookHit } from '@/lib/webhook-activity'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  try {
    // Bare-minimum acknowledgement log so we can confirm hits are arriving
    const typeWebhook = String(body.typeWebhook || 'unknown')

    if (typeWebhook !== 'incomingMessageReceived') {
      // Status callbacks (delivery receipts, etc.) — silently ack
      return NextResponse.json({ ok: true })
    }

    type SenderData = { chatId?: string; chatName?: string; sender?: string; senderName?: string }
    type FileMessageData = { downloadUrl?: string; caption?: string; fileName?: string }
    type MessageData = {
      typeMessage?: string
      fileMessageData?: FileMessageData
      textMessageData?: { textMessage?: string }
      extendedTextMessageData?: { text?: string }
    }
    const senderData = (body.senderData as SenderData | undefined) || {}
    const msg = (body.messageData as MessageData | undefined) || {}
    const chatId: string = senderData.chatId || ''
    const chatName: string = senderData.chatName || ''
    const isGroup = chatId.endsWith('@g.us')
    const msgType: string = msg.typeMessage || ''
    const file = msg.fileMessageData || {}
    const imageUrl: string = msgType === 'imageMessage' ? (file.downloadUrl || '') : ''
    const caption: string =
      (file.caption as string) ||
      (msg.textMessageData?.textMessage as string) ||
      (msg.extendedTextMessageData?.text as string) ||
      ''

    // Track every group we see, even if it's not the configured one
    if (isGroup && chatName) trackGroup(chatId, chatName)

    const baseHit: WebhookHit = {
      ts: Date.now(), type: typeWebhook, chatId, chatName,
      msgType, hasImage: !!imageUrl, caption, outcome: '',
    }

    if (!isGroup) {
      logHit({ ...baseHit, outcome: 'IGNORED: not a group chat' })
      return NextResponse.json({ ok: true })
    }

    // Configured target — ID takes precedence over name
    const [idSetting, nameSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'whatsapp_stock_group_id' } }),
      prisma.setting.findUnique({ where: { key: 'whatsapp_stock_group_name' } }),
    ])
    const rawId = (idSetting?.value || '').trim()
    const targetId = rawId ? (rawId.includes('@') ? rawId : `${rawId}@g.us`) : ''
    const targetName = (nameSetting?.value || '').trim()

    const matchesById = !!targetId && chatId === targetId
    const matchesByName = !targetId && !!targetName && chatName.trim() === targetName

    if (!matchesById && !matchesByName) {
      logHit({ ...baseHit, outcome: `IGNORED: wrong group (target_id="${targetId}", target_name="${targetName}")` })
      return NextResponse.json({ ok: true })
    }

    const result = await importWatchFromMessage(caption, imageUrl)
    if (!result.imported) {
      if (result.skipped === 'empty') {
        logHit({ ...baseHit, outcome: 'SKIPPED: no image and no text' })
      } else {
        logHit({ ...baseHit, outcome: 'SKIPPED: AI flagged as non-transaction' })
      }
      return NextResponse.json({ ok: true, skipped: result.skipped })
    }

    logHit({
      ...baseHit,
      outcome: `✓ IMPORTED as ${result.watchType} watch #${result.watch!.id} "${result.watch!.name}"`,
      watchId: result.watch!.id,
    })
    return NextResponse.json({ ok: true, imported: result.watch!.id })
  } catch (err) {
    console.error('[Webhook] handler error:', err)
    logHit({
      ts: Date.now(), type: 'error', chatId: '', chatName: '',
      msgType: '', hasImage: false, caption: '',
      outcome: `ERROR: ${err instanceof Error ? err.message : String(err)}`,
    })
    return NextResponse.json({ ok: true })
  }
}
