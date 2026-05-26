import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { importWatchFromMessage } from '@/lib/import-watch-from-message'
import { trackGroup, logHit, type WebhookHit } from '@/lib/webhook-activity'

// Hardcoded fallback — the webhook works even if settings are never configured.
// Settings in the DB can still override these if needed.
const DEFAULT_GROUP_ID   = '120363420701421193@g.us'
const DEFAULT_GROUP_NAME = 'Purosangue team BUY AND SELL'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  try {
    const typeWebhook = String(body.typeWebhook || 'unknown')

    if (typeWebhook !== 'incomingMessageReceived') {
      return NextResponse.json({ ok: true })
    }

    type SenderData = { chatId?: string; chatName?: string; sender?: string; senderName?: string }
    type FileMessageData = {
      downloadUrl?: string
      caption?: string
      captionText?: string   // some GreenAPI versions use this instead of caption
      text?: string          // another alternate field
      fileName?: string
    }
    type MessageData = {
      typeMessage?: string
      fileMessageData?: FileMessageData
      videoMessageData?: FileMessageData  // same shape, different key
      textMessageData?: { textMessage?: string }
      extendedTextMessageData?: { text?: string; description?: string }
    }

    const senderData = (body.senderData as SenderData | undefined) || {}
    const msg = (body.messageData as MessageData | undefined) || {}
    const chatId: string = senderData.chatId || ''
    const chatName: string = senderData.chatName || ''
    const isGroup = chatId.endsWith('@g.us')
    const msgType: string = msg.typeMessage || ''

    // Support imageMessage and videoMessage (both can carry a caption + downloadUrl)
    const file: FileMessageData = msg.fileMessageData || msg.videoMessageData || {}
    const imageUrl: string = ['imageMessage', 'videoMessage'].includes(msgType)
      ? (file.downloadUrl || '')
      : ''

    // Robustly extract caption/text from every location GreenAPI may use
    // Different GreenAPI versions and message types put the text in different fields
    const caption: string = (
      file.caption ||
      file.captionText ||
      file.text ||
      msg.textMessageData?.textMessage ||
      msg.extendedTextMessageData?.text ||
      msg.extendedTextMessageData?.description ||
      ''
    ).trim()

    if (isGroup && chatName) trackGroup(chatId, chatName)

    const baseHit: WebhookHit = {
      ts: Date.now(), type: typeWebhook, chatId, chatName,
      msgType, hasImage: !!imageUrl, caption, outcome: '',
    }

    if (!isGroup) {
      logHit({ ...baseHit, outcome: 'IGNORED: not a group chat' })
      return NextResponse.json({ ok: true })
    }

    // Load optional overrides from settings; fall back to hardcoded defaults
    const [idSetting, nameSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'whatsapp_stock_group_id' } }),
      prisma.setting.findUnique({ where: { key: 'whatsapp_stock_group_name' } }),
    ])
    const rawId = (idSetting?.value || '').trim()
    const settingsId = rawId ? (rawId.includes('@') ? rawId : `${rawId}@g.us`) : ''
    const settingsName = (nameSetting?.value || '').trim()

    // Effective values: settings override hardcoded defaults
    const effectiveId   = settingsId   || DEFAULT_GROUP_ID
    const effectiveName = settingsName || DEFAULT_GROUP_NAME

    // Match by ID (preferred) OR by name (case-insensitive fallback)
    const matches =
      chatId === effectiveId ||
      chatName.trim().toLowerCase() === effectiveName.toLowerCase()

    if (!matches) {
      logHit({ ...baseHit, outcome: `IGNORED: wrong group (got "${chatName}" / "${chatId}", effective_id="${effectiveId}", effective_name="${effectiveName}")` })
      return NextResponse.json({ ok: true })
    }

    const result = await importWatchFromMessage(caption, imageUrl)
    if (!result.imported) {
      if (result.skipped === 'empty') {
        logHit({ ...baseHit, outcome: `SKIPPED: no text and no image (msgType="${msgType}")` })
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
