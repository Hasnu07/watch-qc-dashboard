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
  if (!trimmed && !imageUrl) return { imported: false, skipped: 'empty' }

  const parsed: ParsedWatch = trimmed ? parseWhatsAppWatch(trimmed) : {}

  if (trimmed && parsed.should_import === false) {
    return { imported: false, skipped: 'not_a_transaction', parsed }
  }

  const watchType: 'BUY' | 'SELL' = parsed.type === 'SELL' ? 'SELL' : 'BUY'
  const price = parsed.price ?? 0
  const currency = parsed.currency || 'USD'
  const paymentStatus = parsed.payment_status || 'NOT_PAID'

  // ── SELL: try to find and update the existing watch by stock_no ──────────
  if (watchType === 'SELL' && parsed.stock_no) {
    const existing = await prisma.watch.findFirst({
      where: { stock_no: parsed.stock_no, is_sold: false },
    })
    if (existing) {
      const updated = await prisma.watch.update({
        where: { id: existing.id },
        data: {
          is_sold: true,
          sold_to: parsed.sold_to || null,
          payment_status: paymentStatus,
          ...(price > 0 ? { website_price: price, currency } : {}),
        },
      })
      emitWatchEvent({ type: 'new_watch', watchId: updated.id })
      return { imported: true, watch: updated, parsed, watchType }
    }
  }

  const nameParts = [parsed.brand, parsed.model].filter(Boolean) as string[]
  const name = nameParts.length > 0
    ? nameParts.join(' ')
    : (parsed.stock_no ? `Stock #${parsed.stock_no}` : parsed.ref_no || trimmed.split('\n')[0]?.slice(0, 60) || 'WhatsApp Import')

  // Map parsed location_status to DB enum, defaulting based on context
  const locationStatus = parsed.location_status || (parsed.location_from ? 'INCOMING' : 'IN_STOCK')

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
      watch_date: parsed.watch_date || null,
      currency,
      purchase_price: watchType === 'BUY' && price > 0 ? price : null,
      stock_status: 'STOCK',
      watch_type: watchType,
      is_sold: watchType === 'SELL',
      name,
      image_url: imageUrl || null,
      website_price: watchType === 'SELL' ? price : 0,
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
