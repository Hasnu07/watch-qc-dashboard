import { prisma } from './prisma'
import { emitWatchEvent } from './events'
import { createWatchTasks, checkAndUnlockLocation } from './watch-tasks'
import { createWatchSellTasks } from './sell-tasks'
import { parseWhatsAppWatch, forceParseSellMessage, type ParsedWatch } from './parse-whatsapp-watch'
import { enrichFromInventory, lookupInventoryByStockNo } from './inventory-csv'
import { logWatchActivity } from './watch-activity'
import { saveImportInbox } from './import-inbox'
import { hashMessage } from './message-hash'
import { findWatchImageUrl } from './watch-image-fetch'
import { sendImportGroupConfirmation } from './import-confirmation'

export interface ImportOptions {
  source?: 'webhook' | 'paste' | 'inbox'
  force?: boolean
  forceParse?: boolean
  inboxId?: number
  replyChatId?: string
}

export interface ImportResult {
  imported: boolean
  skipped?: 'not_a_transaction' | 'empty' | 'duplicate'
  watch?: Awaited<ReturnType<typeof prisma.watch.create>>
  parsed?: ParsedWatch
  watchType?: 'BUY' | 'SELL'
  inventory_matched?: boolean
  existing_watch_id?: number
  duplicate?: boolean
}

async function findDuplicateWatch(
  stockNo: string | null | undefined,
  watchType: string,
  messageHash: string,
  parsed?: { ref_no?: string | null; brand?: string | null; model?: string | null; bought_from?: string | null; sold_to?: string | null },
) {
  // 1. Exact stock number match
  if (stockNo) {
    const byStock = await prisma.watch.findFirst({
      where: { stock_no: stockNo, watch_type: watchType },
      orderBy: { created_at: 'desc' },
    })
    if (byStock) return byStock
  }

  // 2. Same message hash within 48 h
  try {
    const dupActivity = await prisma.watchActivity.findFirst({
      where: {
        action: 'imported',
        detail: { contains: messageHash },
        created_at: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
    })
    if (dupActivity) {
      return prisma.watch.findUnique({ where: { id: dupActivity.watch_id } })
    }
  } catch {
    // WatchActivity table may not exist yet during migration
  }

  // 3. Same ref_no + brand + watch_type within 30 days (catches forwarded/reformatted messages)
  if (parsed?.ref_no && parsed?.brand) {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const byRef = await prisma.watch.findFirst({
      where: {
        ref_no: { equals: parsed.ref_no, mode: 'insensitive' },
        brand: { equals: parsed.brand, mode: 'insensitive' },
        watch_type: watchType,
        created_at: { gte: since30d },
      },
      orderBy: { created_at: 'desc' },
    })
    if (byRef) return byRef
  }

  // 4. Same brand + model + seller/buyer + watch_type within 7 days (no ref available)
  if (!parsed?.ref_no && parsed?.brand && parsed?.model) {
    const counterparty = watchType === 'SELL' ? parsed.sold_to : parsed.bought_from
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const byBrandModel = await prisma.watch.findFirst({
      where: {
        brand: { equals: parsed.brand, mode: 'insensitive' },
        model: { equals: parsed.model, mode: 'insensitive' },
        watch_type: watchType,
        created_at: { gte: since7d },
        ...(counterparty && watchType === 'SELL'
          ? { sold_to: { equals: counterparty, mode: 'insensitive' } }
          : counterparty
          ? { bought_from: { equals: counterparty, mode: 'insensitive' } }
          : {}),
      },
      orderBy: { created_at: 'desc' },
    })
    if (byBrandModel) return byBrandModel
  }

  return null
}

const WATCH_RELEVANCE_RE = [
  /\b(patek|rolex|audemars|piguet|richard\s*mille|vacheron|cartier|omega|breitling|iwc|hublot|panerai|jaeger|tudor|seiko|zenith|chopard|bulgari|bvlgari|longines|a\.\s*lange)\b/i,
  /\b(seller|sold|bought|purchase|buy)\s*[:\s]/i,
  /\bref(?:erence)?\s*[:#\-]?\s*[A-Z0-9]{3,}/i,
  /[€£$]\s*\d[\d,.]+|\d[\d,.]+\s*(eur|gbp|usd|aed|hkd|usdt)\b/i,
  /purchase\s*price|payment\s*status|location\s*:/i,
]

function mightBeWatchRelated(text: string): boolean {
  return WATCH_RELEVANCE_RE.some(re => re.test(text))
}

type ImportedWatch = Awaited<ReturnType<typeof prisma.watch.create>>

function scheduleBackgroundImageFetch(watch: ImportedWatch) {
  if (watch.image_url) return

  void (async () => {
    try {
      const found = await findWatchImageUrl({
        id: watch.id,
        image_url: null,
        stock_no: watch.stock_no,
        brand: watch.brand,
        model: watch.model,
        ref_no: watch.ref_no,
        linked_buy_watch_id: watch.linked_buy_watch_id,
      })
      if (!found) return

      await prisma.watch.update({
        where: { id: watch.id },
        data: { image_url: found.url },
      })
      await logWatchActivity(watch.id, 'image_fetched', `Auto ${found.source}`)
      emitWatchEvent({ type: 'watch_updated', watchId: watch.id })
    } catch (err) {
      console.error('[import] background image fetch failed for watch', watch.id, err)
    }
  })()
}

export async function importWatchFromMessage(
  text: string,
  imageUrl?: string,
  opts: ImportOptions = {},
): Promise<ImportResult> {
  const trimmed = (text || '').trim()
  if (!trimmed) {
    if (opts.source === 'webhook') {
      await saveImportInbox({ message_text: text || '', image_url: imageUrl, skip_reason: 'empty', source: opts.source })
    }
    return { imported: false, skipped: 'empty' }
  }

  let parsed: ParsedWatch = parseWhatsAppWatch(trimmed)

  if (parsed.should_import === false && opts.forceParse) {
    const forced = forceParseSellMessage(trimmed)
    if (forced) parsed = forced
  }

  if (parsed.should_import === false) {
    // Only queue for review if the message has watch-related content.
    // Pure chat messages (emojis, @mentions, casual text) are silently dropped.
    if ((opts.source === 'webhook' || opts.source === 'paste') && (opts.source === 'paste' || mightBeWatchRelated(trimmed))) {
      await saveImportInbox({
        source: opts.source,
        message_text: trimmed,
        image_url: imageUrl,
        skip_reason: 'not_a_transaction',
        parsed,
      })
    }
    return { imported: false, skipped: 'not_a_transaction', parsed }
  }

  const watchType: 'BUY' | 'SELL' = parsed.type === 'SELL' ? 'SELL' : 'BUY'
  const msgHash = hashMessage(trimmed)

  if (!opts.force) {
    const duplicate = await findDuplicateWatch(parsed.stock_no, watchType, msgHash, parsed)
    if (duplicate) {
      await saveImportInbox({
        source: opts.source || 'webhook',
        message_text: trimmed,
        image_url: imageUrl,
        skip_reason: 'duplicate',
        parsed,
        watch_id: duplicate.id,
      })
      return {
        imported: false,
        skipped: 'duplicate',
        parsed,
        existing_watch_id: duplicate.id,
        duplicate: true,
      }
    }
  }

  const inv = parsed.stock_no ? lookupInventoryByStockNo(parsed.stock_no) : null

  const enriched = enrichFromInventory(
    {
      brand: parsed.brand || null,
      model: parsed.model || null,
      ref_no: parsed.ref_no || null,
      serial_no: parsed.serial_no || null,
      bought_from: parsed.bought_from || null,
      sold_to: parsed.sold_to || null,
      price: parsed.price ?? 0,
      currency: parsed.currency || 'USD',
      payment_status: parsed.payment_status || 'NOT_PAID',
      watch_date: parsed.watch_date || null,
      dial_colour: parsed.dial_colour || null,
      bracelet: parsed.bracelet || null,
      case_material: parsed.case_material || null,
      image_url: imageUrl || null,
      location_to: parsed.location_to || null,
      website_price: watchType === 'SELL' && (parsed.price ?? 0) > 0 ? parsed.price : 0,
    },
    parsed.stock_no,
    { preferSoldPrice: watchType === 'SELL' },
  )

  let brand = enriched.brand || null
  let model = enriched.model || null
  let ref_no = enriched.ref_no || null
  let dial_colour = enriched.dial_colour || null
  let bracelet = enriched.bracelet || null
  let case_material = enriched.case_material || null
  let watch_date = enriched.watch_date || null
  let resolvedImageUrl = enriched.image_url || null
  const price = enriched.price ?? 0
  const currency = enriched.currency || 'USD'
  const paymentStatus = enriched.payment_status || 'NOT_PAID'
  let soldTo = enriched.sold_to || null
  let boughtFrom = enriched.bought_from || null
  let websitePrice = watchType === 'SELL' && price > 0 ? price : (enriched.website_price ?? 0)
  let locationTo = enriched.location_to || parsed.location_to || null
  let linkedBuyWatchId: number | null = null
  let fobUrl: string | null = (enriched as { fob_url?: string }).fob_url || inv?.fob_url || null

  if (watchType === 'SELL' && parsed.stock_no) {
    const source = await prisma.watch.findFirst({
      where: { stock_no: parsed.stock_no, watch_type: { not: 'SELL' } },
      orderBy: { created_at: 'desc' },
    })
    if (source) {
      linkedBuyWatchId = source.id
      brand = brand || source.brand
      model = model || source.model
      ref_no = ref_no || source.ref_no
      dial_colour = dial_colour || source.dial_colour
      bracelet = bracelet || source.bracelet
      case_material = case_material || source.case_material
      watch_date = watch_date || source.watch_date
      resolvedImageUrl = resolvedImageUrl || source.image_url
      fobUrl = fobUrl || source.fob_url
    }
  }

  const nameParts = [brand, model].filter(Boolean) as string[]
  const name = nameParts.length > 0
    ? nameParts.join(' ')
    : parsed.stock_no
      ? `Stock #${parsed.stock_no}${soldTo ? ` → ${soldTo}` : ''}`
      : parsed.ref_no || soldTo || trimmed.split('\n')[0]?.slice(0, 60) || 'WhatsApp Import'

  const locationStatus = parsed.location_status || (parsed.location_from ? 'INCOMING' : 'IN_STOCK')

  const watch = await prisma.watch.create({
    data: {
      brand,
      model,
      ref_no,
      stock_no: parsed.stock_no || null,
      bought_from: watchType === 'BUY' ? boughtFrom : null,
      sold_to: watchType === 'SELL' ? soldTo : null,
      case_material,
      dial_colour,
      bracelet,
      watch_date,
      currency,
      purchase_price: watchType === 'BUY' && price > 0 ? price : null,
      stock_status: 'STOCK',
      watch_type: watchType,
      is_sold: false,
      name,
      image_url: resolvedImageUrl,
      website_price: watchType === 'SELL' ? (price > 0 ? price : websitePrice) : websitePrice,
      b2b_price: 0,
      payment_status: paymentStatus,
      location_status: locationStatus,
      location_from: parsed.location_from || null,
      location_to: locationTo,
      linked_buy_watch_id: linkedBuyWatchId,
      fob_url: fobUrl,
    },
  })

  await logWatchActivity(
    watch.id,
    'imported',
    `${watchType} via ${opts.source || 'message'} · hash:${msgHash}${enriched.inventory_matched ? ' · CSV matched' : ''}${linkedBuyWatchId ? ` · linked buy #${linkedBuyWatchId}` : ''}`,
  )

  if (watchType === 'SELL') {
    await createWatchSellTasks(watch.id, watch.name)
    if (linkedBuyWatchId) {
      logWatchActivity(linkedBuyWatchId, 'sell_linked', `Sell watch #${watch.id} created for stock #${parsed.stock_no}`).catch(console.error)
    }
  } else {
    await createWatchTasks(watch.id, watch.name)
  }

  if (paymentStatus === 'PAID' || paymentStatus === 'PARTIAL') {
    checkAndUnlockLocation(watch.id).catch(console.error)
  }

  emitWatchEvent({ type: 'new_watch', watchId: watch.id })

  scheduleBackgroundImageFetch(watch)

  if (opts.replyChatId) {
    sendImportGroupConfirmation(opts.replyChatId, watch, watchType).catch(console.error)
  }

  if (opts.inboxId) {
    const { markImportInboxImported } = await import('./import-inbox')
    await markImportInboxImported(opts.inboxId, watch.id)
  }

  return { imported: true, watch, parsed, watchType, inventory_matched: enriched.inventory_matched }
}
