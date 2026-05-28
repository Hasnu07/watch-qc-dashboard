import { prisma } from './prisma'
import { emitWatchEvent } from './events'
import { createWatchTasks } from './watch-tasks'
import { createWatchSellTasks } from './sell-tasks'
import { parseWhatsAppWatch, type ParsedWatch } from './parse-whatsapp-watch'

export interface ImportResult {
  imported: boolean
  skipped?: 'not_a_transaction' | 'empty'
  watch?: Awaited<ReturnType<typeof prisma.watch.create>>
  parsed?: ParsedWatch
  watchType?: 'BUY' | 'SELL'
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
  const price = parsed.price ?? 0
  const currency = parsed.currency || 'USD'
  const paymentStatus = parsed.payment_status || 'NOT_PAID'

  // SELL: copy details from the matching stock watch if we have one, but always create a new entry.
  let brand = parsed.brand || null
  let model = parsed.model || null
  let ref_no = parsed.ref_no || null
  let dial_colour = parsed.dial_colour || null
  let bracelet = parsed.bracelet || null
  let case_material = parsed.case_material || null
  let watch_date = parsed.watch_date || null
  let resolvedImageUrl = imageUrl || null

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
      ? `Stock #${parsed.stock_no}${parsed.sold_to ? ` → ${parsed.sold_to}` : ''}`
      : parsed.ref_no || parsed.sold_to || trimmed.split('\n')[0]?.slice(0, 60) || 'WhatsApp Import'

  const locationStatus = parsed.location_status || (parsed.location_from ? 'INCOMING' : 'IN_STOCK')

  const watch = await prisma.watch.create({
    data: {
      brand,
      model,
      ref_no,
      stock_no: parsed.stock_no || null,
      bought_from: watchType === 'BUY' ? (parsed.bought_from || null) : null,
      sold_to: watchType === 'SELL' ? (parsed.sold_to || null) : null,
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
      website_price: watchType === 'SELL' && price > 0 ? price : 0,
      b2b_price: 0,
      payment_status: paymentStatus,
      location_status: locationStatus,
      location_from: parsed.location_from || null,
      location_to: parsed.location_to || null,
    },
  })

  if (watchType === 'SELL') {
    createWatchSellTasks(watch.id, watch.name).catch(console.error)
  } else {
    createWatchTasks(watch.id, watch.name).catch(console.error)
  }
  emitWatchEvent({ type: 'new_watch', watchId: watch.id })

  return { imported: true, watch, parsed, watchType }
}
