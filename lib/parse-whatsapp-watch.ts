// Pure regex/rule-based parser — no AI, no API costs.
// Handles the structured watch-card format your team uses as well as
// older informal buy/sell messages.

export interface ParsedWatch {
  should_import?: boolean
  type?: 'BUY' | 'SELL' | null
  brand?: string | null
  model?: string | null
  ref_no?: string | null
  serial_no?: string | null
  stock_no?: string | null
  bought_from?: string | null
  sold_to?: string | null
  price?: number | null
  currency?: 'USD' | 'GBP' | 'EUR' | 'AED' | 'HKD' | null
  payment_status?: 'PAID' | 'PARTIAL' | 'NOT_PAID' | null
  case_material?: string | null
  dial_colour?: string | null
  bracelet?: string | null
  watch_date?: string | null
  location_status?: 'INCOMING' | 'IN_STOCK' | 'IN_TRANSIT' | null
  location_from?: string | null
  location_to?: string | null
  notes?: string | null
}

// Known luxury brands — used to split "Patek Philippe Cubitus" into brand+model
const BRANDS = [
  'Patek Philippe', 'Rolex', 'Audemars Piguet', 'Richard Mille',
  'Vacheron Constantin', 'IWC', 'Cartier', 'Omega', 'Breitling',
  'Jaeger-LeCoultre', 'Panerai', 'Hublot', 'TAG Heuer', 'Zenith',
  'Chopard', 'Bvlgari', 'Bulgari', 'Longines', 'Tudor', 'Seiko',
  'Grand Seiko', 'A. Lange', 'Lange', 'F.P. Journe', 'Greubel Forsey',
]

function field(text: string, ...keys: string[]): string | null {
  for (const key of keys) {
    const re = new RegExp(`^${key}\\s*:\\s*(.+)$`, 'im')
    const m = text.match(re)
    if (m) return m[1].trim()
  }
  return null
}

function parsePrice(raw: string): number | null {
  // Remove spaces, strip thousands separators (both , and . style)
  // "132,000" → 132000   "55.000" → 55000   "102 000" → 102000
  const cleaned = raw.replace(/\s/g, '').replace(/[,.](\d{3})(?!\d)/g, '$1')
  const n = parseInt(cleaned.replace(/[^0-9]/g, ''), 10)
  return isNaN(n) || n === 0 ? null : n
}

function parseCurrency(text: string): 'USD' | 'GBP' | 'EUR' | 'AED' | 'HKD' | null {
  const t = text.toLowerCase()
  if (/\beur(o)?\b|€/.test(t)) return 'EUR'
  if (/\bgbp\b|£/.test(t)) return 'GBP'
  if (/\baed\b|\bdirham/.test(t)) return 'AED'
  if (/\bhkd\b/.test(t)) return 'HKD'
  if (/\busdt\b/.test(t)) return 'USD'
  if (/\busd\b|\$/.test(t)) return 'USD'
  return null
}

function splitBrandModel(modelText: string): { brand: string | null; model: string | null } {
  for (const b of BRANDS) {
    if (modelText.toLowerCase().startsWith(b.toLowerCase())) {
      const model = modelText.slice(b.length).trim() || null
      return { brand: b, model }
    }
  }
  return { brand: null, model: modelText || null }
}

export function parseWhatsAppWatch(text: string): ParsedWatch {
  if (!text || !text.trim()) return { should_import: false }
  const t = text.trim()

  // ── TYPE & IMPORT DETECTION ──────────────────────────────────────────────
  const hasBuySignal =
    /^seller\s*:/im.test(t) ||
    /\bbuy\s+from\b/i.test(t) ||
    /\bbought\s+from\b/i.test(t) ||
    /^purchase\s+price\s*:/im.test(t) ||
    /for\s+hassan\s*\(accounting\)/i.test(t) ||
    /for\s+haris\s*\(logistics\)/i.test(t)

  const hasSellSignal =
    /\bsold\s+(\d+\s+)?to\b/i.test(t) ||
    /\bsold\s+(\d+\s+)?do\b/i.test(t) ||
    /\bsold\s+\d+\s+for\b/i.test(t) ||
    /\bsold\s+\d{3,6}\s+to\s+\S+[\s\S]*?\bfor\s+[\d,.]+\s*(usdt|usd|eur|gbp|aed|hkd)\b/i.test(t) ||
    /^sold\s+to\s*:/im.test(t) ||
    /^sold\s+do\s*:/im.test(t) ||
    /^sold\s+to\s+\S/im.test(t) ||
    /^sold\s+do\s+\S/im.test(t) ||
    /\bsold\s+\d{3,6}\b/i.test(t) ||
    /^\d{3,6}\s+sold\b/im.test(t) ||
    /\b\d{3,6}\s*(?:→|->)\s*\S+/i.test(t)

  // Informal sell: "1002 for 62000 usdt" on its own line
  const hasStockForPrice = /^\d{3,6}\s+for\s+[\d,.]+\s*(usdt|usd|eur|gbp|aed|hkd)\b/im.test(t)

  // Also import if ref + price appear together (informal format)
  const hasRefAndPrice =
    /\b[A-Z0-9]{5,}[-/][A-Z0-9]+\b|\b1[26]\d{4}[A-Z]{0,3}\b/.test(t) &&
    /\d[\d,.]+\s*(euro|eur|gbp|aed|usd|hkd)/i.test(t)

  if (!hasBuySignal && !hasSellSignal && !hasRefAndPrice && !hasStockForPrice) {
    return { should_import: false }
  }

  const type: 'BUY' | 'SELL' =
    (hasSellSignal || hasStockForPrice) && !hasBuySignal ? 'SELL' : 'BUY'

  // ── SELLER / BUYER ───────────────────────────────────────────────────────
  let bought_from: string | null = field(t, 'Seller', 'Bought from', 'Buy from')
  if (!bought_from) {
    const m = t.match(/\bbuy\s+from\s+([^\n,]+)/i) || t.match(/\bbought\s+from\s+([^\n,]+)/i)
    if (m) bought_from = m[1].trim()
  }

  let sold_to: string | null = null
  if (type === 'SELL') {
    const arrowTo = t.match(/\b\d{3,6}\s*(?:→|->)\s+(\S+)/i)
    const soldForTo = t.match(/\bsold\s+\d+\s+for\s+[\d,. ]+\s*\w+\s+to\s+(.+?)(?:\n|$)/i)
    const m =
      arrowTo ||
      soldForTo ||
      t.match(/sold\s+(?:\d+\s+)?to\s+(.+?)(?:\s+for\s+[\d]|\s+@\s*[\d]|\n|$)/i) ||
      t.match(/sold\s+(?:\d+\s+)?do\s+(.+?)(?:\s+for\s+[\d]|\s+@\s*[\d]|\n|$)/i) ||
      t.match(/^sold\s+to\s*:\s*(.+)$/im) ||
      t.match(/^sold\s+to\s+(.+)$/im) ||
      t.match(/^sold\s+do\s*:\s*(.+)$/im) ||
      t.match(/^sold\s+do\s+(.+)$/im)
    if (m) sold_to = m[1].trim()
  }

  // ── BRAND + MODEL ────────────────────────────────────────────────────────
  let brand: string | null = null
  let model: string | null = null
  const modelRaw = field(t, 'Model')
  if (modelRaw) {
    const split = splitBrandModel(modelRaw)
    brand = split.brand
    model = split.model
  }

  // ── REFERENCE ────────────────────────────────────────────────────────────
  let ref_no: string | null = field(t, 'Reference', 'Ref', 'Ref No', 'Ref\\.', 'Reference No')
  if (!ref_no) {
    // Fallback: look for a standalone ref-number pattern near top of message
    const m = t.match(/\b([A-Z0-9]{3,}[-/][A-Z0-9]+)\b/)
    if (m) ref_no = m[1]
  }
  // Infer Rolex from ref starting with 12/22/32
  if (!brand && ref_no && /^[123]\d{5}[A-Z]{0,3}$/.test(ref_no)) brand = 'Rolex'

  // ── SERIAL ───────────────────────────────────────────────────────────────
  const serial_no = field(t, 'Serial Number', 'Serial No', 'Serial')

  // ── STOCK NO ─────────────────────────────────────────────────────────────
  let stock_no: string | null = null
  const stockSoldToMatch = t.match(/\bsold\s+(\d+)\s+to\b/i)
  const stockSoldForMatch = t.match(/\bsold\s+(\d+)\s+for\b/i)
  const stockSoldBareMatch = t.match(/\bsold\s+(\d{3,6})\b/i)
  const stockSuffixSoldMatch = t.match(/^(\d{3,6})\s+sold\b/im)
  const stockArrowMatch = t.match(/\b(\d{3,6})\s*(?:→|->)\s*\S+/i)
  const stockForMatch = t.match(/^(\d{3,6})\s+for\s+[\d,.]+\s*(usdt|usd|eur|gbp|aed|hkd)\b/im)
  if (stockSoldForMatch) stock_no = stockSoldForMatch[1]
  else if (stockSoldToMatch) stock_no = stockSoldToMatch[1]
  else if (stockSoldBareMatch) stock_no = stockSoldBareMatch[1]
  else if (stockSuffixSoldMatch) stock_no = stockSuffixSoldMatch[1]
  else if (stockArrowMatch) stock_no = stockArrowMatch[1]
  else if (stockForMatch) stock_no = stockForMatch[1]
  else stock_no = field(t, 'Stock No', 'Stock Number', 'Stock')

  // ── DIAL & BRACELET ──────────────────────────────────────────────────────
  const dial_colour = field(t, 'Dial')
  const bracelet = field(t, 'Bracelet')
  const case_material = field(t, 'Case Material', 'Case', 'Material') // rarely in messages
  const watch_date = field(t, 'Watch Date', 'Date', 'Year')

  // ── PRICE ────────────────────────────────────────────────────────────────
  let price: number | null = null
  let currency: 'USD' | 'GBP' | 'EUR' | 'AED' | 'HKD' | null = null

  // Try labelled price first: "Purchase Price: 132,000 euro"
  const labeledPrice = field(t, 'Purchase Price', 'Price', 'Cost', 'Amount', 'Total Amount')
  if (labeledPrice) {
    const pm = labeledPrice.match(/([\d,. ]+)/)
    if (pm) price = parsePrice(pm[1])
    currency = parseCurrency(labeledPrice)
    if (!currency) currency = parseCurrency(t) // fallback: scan whole message
  }

  // Fallback: "Sold 1305 for 680.000 Hkd to ..." or bare price patterns
  if (!price) {
    const soldForLine = t.match(/\bsold\s+\d+\s+for\s+([\d,. ]+)\s*(hkd|usd|eur|gbp|£|aed|usdt)\b/i)
    if (soldForLine) {
      price = parsePrice(soldForLine[1])
      currency = parseCurrency(soldForLine[0])
    }
  }
  if (!price) {
    const stockLine = t.match(/^(\d{3,6})\s+for\s+([\d,. ]+)\s*(usdt|usd|eur|gbp|£|aed|hkd)\b/im)
    if (stockLine) {
      price = parsePrice(stockLine[2])
      currency = parseCurrency(stockLine[0])
    }
  }
  if (!price) {
    const pm = t.match(/\b([\d,.]{4,})\s*(euro|eur|gbp|£|usd|\$|aed|hkd|usdt)\b/i)
    if (pm) {
      price = parsePrice(pm[1])
      currency = parseCurrency(pm[0])
    }
  }

  // ── PAYMENT STATUS ───────────────────────────────────────────────────────
  let payment_status: 'PAID' | 'PARTIAL' | 'NOT_PAID' | null = null
  if (/not\s+paid|❌/i.test(t)) payment_status = 'NOT_PAID'
  else if (/\bpartial\b/i.test(t)) payment_status = 'PARTIAL'
  else if (/\bpaid\b/i.test(t)) payment_status = 'PAID'

  // ── LOCATION ─────────────────────────────────────────────────────────────
  let location_status: 'INCOMING' | 'IN_STOCK' | 'IN_TRANSIT' | null = null
  let location_from: string | null = null
  let location_to: string | null = null

  const locRaw = field(t, 'Location')
  if (locRaw) {
    const loc = locRaw.replace(/[📍🔴]/g, '').trim()
    if (/incoming/i.test(loc)) location_status = 'INCOMING'
    else if (/in\s+transit/i.test(loc)) location_status = 'IN_TRANSIT'
    else location_status = 'IN_STOCK'

    // "Italy – Incoming Inventory Dubai"  →  from=Italy  to=Dubai
    const dashMatch = loc.match(/^(.+?)\s*[–\-]\s*(?:incoming\s+inventory\s+)?(.+)$/i)
    if (dashMatch) {
      location_from = dashMatch[1].trim()
      location_to   = dashMatch[2].replace(/incoming\s+inventory\s*/i, '').trim()
    } else {
      const toMatch = loc.match(/incoming\s+(?:inventory\s+)?(.+)/i)
      if (toMatch) location_to = toMatch[1].trim()
    }
  }

  // ── NOTES ────────────────────────────────────────────────────────────────
  const setVal = field(t, 'Set') || (/\bfull\s+set\b/i.test(t) ? 'Full set' : null)
  const deliverMatch = t.match(/^(need to deliver[^\n]*|nonpayment on collection[^\n]*)/im)
  const paymentMethodMatch = t.match(/^(paid\s+(?:wire|cash|bank|cheque|transfer|crypto)[^\n]*)/im)
  const notes = [setVal, deliverMatch?.[1]?.trim(), paymentMethodMatch?.[1]?.trim()].filter(Boolean).join('. ') || null

  return {
    should_import: true,
    type,
    brand,
    model,
    ref_no,
    serial_no,
    stock_no,
    bought_from,
    sold_to,
    price,
    currency,
    payment_status,
    case_material,
    dial_colour,
    bracelet,
    watch_date,
    location_status,
    location_from,
    location_to,
    notes,
  }
}

/** Last-resort sell parse when user clicks "Import anyway" on skipped inbox items. */
export function forceParseSellMessage(text: string): ParsedWatch | null {
  const t = (text || '').trim()
  if (!t) return null

  const arrowMatch = t.match(/\b(\d{3,6})\s*(?:→|->|to)\s+(\S+)/i)
  const soldPrefix = t.match(/\bsold\s+(\d{3,6})\b/i)
  const soldSuffix = t.match(/^(\d{3,6})\s+sold\b/im)
  const stock = arrowMatch?.[1] || soldPrefix?.[1] || soldSuffix?.[1] || null
  if (!stock) return null

  return {
    should_import: true,
    type: 'SELL',
    stock_no: stock,
    sold_to: arrowMatch?.[2] || null,
  }
}

// Keep async signature so callers don't need to change
export async function parseWhatsAppWatchAsync(text: string): Promise<ParsedWatch> {
  return parseWhatsAppWatch(text)
}
