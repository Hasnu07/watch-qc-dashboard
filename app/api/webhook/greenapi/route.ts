import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitWatchEvent } from '@/lib/events'
import { createWatchTasks } from '@/lib/watch-tasks'
import { createWatchSellTasks } from '@/lib/sell-tasks'

// Ring buffer of recently-seen group chats so the user can find their group's
// chat ID from the Settings UI. Keyed by chatId, stores the most recent name.
type RecentGroup = { chatId: string; chatName: string; lastSeenAt: number }
const recentGroups = new Map<string, RecentGroup>()

export function getRecentGroups(): RecentGroup[] {
  return Array.from(recentGroups.values()).sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, 20)
}

interface ParsedWatch {
  type?: 'BUY' | 'SELL'
  brand?: string | null
  model?: string | null
  ref_no?: string | null
  stock_no?: string | null
  bought_from?: string | null
  sold_to?: string | null
  website_price?: number | null
  b2b_price?: number | null
  case_material?: string | null
  dial_colour?: string | null
  bracelet?: string | null
}

async function parseCaption(caption: string, origin: string): Promise<ParsedWatch> {
  try {
    const res = await fetch(`${origin}/api/ai/parse-whatsapp-watch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: caption }),
    })
    if (!res.ok) return {}
    return await res.json()
  } catch (err) {
    console.error('[Webhook] AI parse failed:', err)
    return {}
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (body.typeWebhook !== 'incomingMessageReceived') {
      return NextResponse.json({ ok: true })
    }

    const chatId: string = body.senderData?.chatId || ''
    const chatName: string = body.senderData?.chatName || ''
    const isGroup = chatId.endsWith('@g.us')

    // Track recent group chats so the user can find their group's name
    if (isGroup && chatName) {
      recentGroups.set(chatId, { chatId, chatName, lastSeenAt: Date.now() })
    }

    // Look up the configured stock-photos group name
    const groupSetting = await prisma.setting.findUnique({
      where: { key: 'whatsapp_stock_group_name' },
    })
    const targetGroup = (groupSetting?.value || '').trim()

    // Only proceed if this message is from the configured group
    if (!isGroup || !targetGroup || chatName.trim() !== targetGroup) {
      console.log(`[Webhook] Ignored — chat="${chatName}" target="${targetGroup}"`)
      return NextResponse.json({ ok: true })
    }

    const msg = body.messageData
    const typeMessage: string = msg?.typeMessage || ''

    // Pull whatever text and image are present — both, either, or just one is fine.
    // Image-bearing types come through with fileMessageData; plain text comes through
    // textMessageData or extendedTextMessageData.
    const file = msg?.fileMessageData || {}
    const imageUrl: string = typeMessage === 'imageMessage' ? (file.downloadUrl || '') : ''
    const caption: string =
      (file.caption as string) ||
      (msg?.textMessageData?.textMessage as string) ||
      (msg?.extendedTextMessageData?.text as string) ||
      ''

    // Need *something* — either an image to store, or text we can parse.
    if (!imageUrl && !caption.trim()) {
      console.log(`[Webhook] Group msg type=${typeMessage} had no image and no text — skipping`)
      return NextResponse.json({ ok: true })
    }

    // Use AI to parse the caption/text into structured fields
    const origin = new URL(req.url).origin
    const parsed = caption.trim() ? await parseCaption(caption, origin) : {}
    const watchType: 'BUY' | 'SELL' = parsed.type === 'SELL' ? 'SELL' : 'BUY'

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
        currency: 'USD',
        stock_status: 'STOCK',
        watch_type: watchType,
        name,
        image_url: imageUrl || null,
        website_price: parsed.website_price ?? 0,
        b2b_price: parsed.b2b_price ?? 0,
        payment_status: 'NOT_PAID',
        location_status: 'IN_STOCK',
      },
    })

    // Create the right phase tasks based on detected type
    if (watchType === 'SELL') {
      createWatchSellTasks(watch.id, watch.name).catch(console.error)
    } else {
      createWatchTasks(watch.id, watch.name).catch(console.error)
    }

    emitWatchEvent({ type: 'new_watch', watchId: watch.id })
    console.log(`[Webhook] ✓ Auto-imported ${watchType} watch #${watch.id} "${name}" from group "${chatName}" ${imageUrl ? '[with image]' : '[text-only]'}`)

    return NextResponse.json({ ok: true, imported: watch.id })
  } catch (err) {
    console.error('[Webhook] handler error:', err)
    return NextResponse.json({ ok: true })
  }
}
