import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { importWatchFromMessage } from '@/lib/import-watch-from-message'
import { trackGroup, logHit, type WebhookHit } from '@/lib/webhook-activity'
import { extractWebhookMessage, matchesStockGroup } from '@/lib/webhook-extract'

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

    const senderData = (body.senderData as SenderData | undefined) || {}
    const msg = (body.messageData as Parameters<typeof extractWebhookMessage>[0] | undefined) || {}
    const chatId: string = senderData.chatId || ''
    const chatName: string = senderData.chatName || ''
    const isGroup = chatId.endsWith('@g.us')

    const { caption, imageUrl, msgType } = extractWebhookMessage(msg)

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

    const matches = matchesStockGroup(chatId, chatName, effectiveId, effectiveName)

    if (!matches) {
      logHit({ ...baseHit, outcome: `IGNORED: wrong group (got "${chatName}" / "${chatId}", effective_id="${effectiveId}", effective_name="${effectiveName}")` })
      return NextResponse.json({ ok: true })
    }

    const result = await importWatchFromMessage(caption, imageUrl, { source: 'webhook' })
    if (!result.imported) {
      if (result.skipped === 'empty') {
        logHit({ ...baseHit, outcome: `SKIPPED: no parseable text (msgType="${msgType}", hasImage=${!!imageUrl})` })
      } else {
        logHit({ ...baseHit, outcome: `SKIPPED: not a watch transaction (msgType="${msgType}")` })
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
