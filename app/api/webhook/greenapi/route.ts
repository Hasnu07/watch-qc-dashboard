import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitWatchEvent } from '@/lib/events'
import { createWatchTasks } from '@/lib/watch-tasks'
import { createWatchSellTasks } from '@/lib/sell-tasks'
import { parseWhatsAppWatch, type ParsedWatch } from '@/lib/parse-whatsapp-watch'

// In-memory ring buffer of recently-seen group chats so the user can find
// their group's name/ID from the Settings UI.
type RecentGroup = { chatId: string; chatName: string; lastSeenAt: number }
const recentGroups = new Map<string, RecentGroup>()

export function getRecentGroups(): RecentGroup[] {
  return Array.from(recentGroups.values()).sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, 20)
}

// In-memory log of webhook hits for diagnostic purposes. Helps the user see
// "is the bot even forwarding anything to me?" — visible in Settings.
type WebhookHit = {
  ts: number
  type: string
  chatId: string
  chatName: string
  msgType: string
  hasImage: boolean
  caption: string
  outcome: string
  watchId?: number
}
const recentHits: WebhookHit[] = []
const MAX_HITS = 25

function logHit(hit: WebhookHit) {
  recentHits.unshift(hit)
  if (recentHits.length > MAX_HITS) recentHits.length = MAX_HITS
  console.log(`[Webhook] ${hit.outcome}: chatId=${hit.chatId} chat="${hit.chatName}" msgType=${hit.msgType} image=${hit.hasImage} caption="${hit.caption.slice(0, 80)}"`)
}

export function getRecentHits(): WebhookHit[] {
  return recentHits.slice()
}

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
    if (isGroup && chatName) {
      recentGroups.set(chatId, { chatId, chatName, lastSeenAt: Date.now() })
    }

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

    if (!imageUrl && !caption.trim()) {
      logHit({ ...baseHit, outcome: 'SKIPPED: no image and no text' })
      return NextResponse.json({ ok: true })
    }

    // Parse caption directly via the AI lib (no self-fetch — that fails on Render)
    let parsed: ParsedWatch = {}
    if (caption.trim()) {
      parsed = await parseWhatsAppWatch(caption)
      if (parsed.should_import === false) {
        logHit({ ...baseHit, outcome: 'SKIPPED: AI flagged as non-transaction' })
        return NextResponse.json({ ok: true, skipped: 'not_a_transaction' })
      }
    }

    const watchType: 'BUY' | 'SELL' = parsed.type === 'SELL' ? 'SELL' : 'BUY'
    const price = parsed.price ?? 0
    const currency = parsed.currency || 'USD'
    const paymentStatus = parsed.payment_status || 'NOT_PAID'

    const nameParts = [parsed.brand, parsed.model].filter(Boolean) as string[]
    const name = nameParts.length > 0
      ? nameParts.join(' ')
      : (parsed.ref_no || caption.split('\n')[0]?.slice(0, 60) || 'WhatsApp Import')

    const watch = await prisma.watch.create({
      data: {
        brand: parsed.brand || null,
        model: parsed.model || null,
        ref_no: parsed.ref_no || null,
        stock_no: parsed.stock_no || null,
        bought_from: watchType === 'BUY' ? (parsed.bought_from || null) : null,
        sold_to: watchType === 'SELL' ? (parsed.sold_to || null) : null,
        case_material: parsed.case_material || null,
        dial_colour: parsed.dial_colour || null,
        bracelet: parsed.bracelet || null,
        currency,
        purchase_price: watchType === 'BUY' && price > 0 ? price : null,
        stock_status: 'STOCK',
        watch_type: watchType,
        name,
        image_url: imageUrl || null,
        website_price: watchType === 'SELL' ? price : 0,
        b2b_price: 0,
        payment_status: paymentStatus,
        location_status: 'IN_STOCK',
      },
    })

    if (watchType === 'SELL') {
      createWatchSellTasks(watch.id, watch.name).catch(console.error)
    } else {
      createWatchTasks(watch.id, watch.name).catch(console.error)
    }
    emitWatchEvent({ type: 'new_watch', watchId: watch.id })

    logHit({ ...baseHit, outcome: `✓ IMPORTED as ${watchType} watch #${watch.id} "${name}"`, watchId: watch.id })
    return NextResponse.json({ ok: true, imported: watch.id })
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
