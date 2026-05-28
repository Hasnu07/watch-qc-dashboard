import { prisma } from './prisma'
import { emitWatchEvent } from './events'
import { createWatchTasks } from './watch-tasks'
import { createWatchSellTasks } from './sell-tasks'
import { parseWhatsAppWatch, type ParsedWatch } from './parse-whatsapp-watch'
import { enrichFromInventory } from './inventory-csv'

export interface ImportResult {
  imported: boolean
  skipped?: 'not_a_transaction' | 'empty'
  watch?: Awaited<ReturnType<typeof prisma.watch.create>>
  parsed?: ParsedWatch
  watchType?: 'BUY' | 'SELL'
  inventory_matched?: boolean
}

// Shared between the WhatsApp webhook and the manual "Paste Message" UI flow.
// Returns the created watch, or a reason it was skipped — never throws.
export async function importWatchFromMessage(text: string, imageUrl?: string): Promise<ImportResult> {
  const trimmed = (text || '').trim()
  if (!trimmed) return { imported: false, skipped: 'empty' }

  const parsed: ParsedWatch = parseWhatsAppWatch(trimmed)

  if (parsed.should_import === false) {
    return { imported: false, skipped: 'not_a_transaction', parsed }
  }

  const watchType: 'BUY' | 'SELL' = parsed.type === 'SELL' ? 'SELL' : 'BUY'

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

  if (watchType === 'SELL' && parsed.stock_no) {
    const source = await prisma.watch.findFirst({
      where: { stock_no: parsed.stock_no, watch_type: { not: 'SELL' } },
      orderBy: { created_at: 'desc' },
    })
    if (source) {
      brand = brand || source.brand
      model = model || source.model
      ref_no = ref_no || source.ref_no
      dial_colour = dial_colour || source.dial_colour
      bracelet = bracelet || source.bracelet
      case_material = case_material || source.case_material
      watch_date = watch_date || source.watch_date
      resolvedImageUrl = resolvedImageUrl || source.image_url
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
    },
  })

  if (watchType === 'SELL') {
    createWatchSellTasks(watch.id, watch.name).catch(console.error)
  } else {
    createWatchTasks(watch.id, watch.name).catch(console.error)
  }
  emitWatchEvent({ type: 'new_watch', watchId: watch.id })

  return { imported: true, watch, parsed, watchType, inventory_matched: enriched.inventory_matched }
}
