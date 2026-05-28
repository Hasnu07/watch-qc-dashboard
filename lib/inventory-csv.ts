import fs from 'fs'
import path from 'path'

export interface InventoryRecord {
  stock_no: string
  brand: string | null
  model: string | null
  ref_no: string | null
  serial_no: string | null
  bought_from: string | null
  sold_to: string | null
  purchase_price: number | null
  sold_price: number | null
  website_price: number | null
  watch_date: string | null
  payment_status: 'PAID' | 'PARTIAL' | 'NOT_PAID' | null
  image_url: string | null
  category: string | null
  currency: string
}

let cache: Map<string, InventoryRecord> | null = null

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

function pick(row: string[], idx: Map<string, number>, ...keys: string[]): string {
  for (const key of keys) {
    const i = idx.get(key)
    if (i == null) continue
    const v = (row[i] || '').trim()
    if (v) return v
  }
  return ''
}

function parseMoney(raw: string): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/[£$€,\s]/g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parsePaymentStatus(raw: string): 'PAID' | 'PARTIAL' | 'NOT_PAID' | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null
  if (/not\s*paid|unpaid|un\s*paid/.test(t)) return 'NOT_PAID'
  if (/partial/.test(t)) return 'PARTIAL'
  if (/paid/.test(t)) return 'PAID'
  return null
}

function normalizeStockNo(raw: string): string {
  return raw.replace(/^#/, '').trim()
}

function scoreRecord(rec: InventoryRecord): number {
  let s = 0
  if (rec.brand) s += 2
  if (rec.model) s += 2
  if (rec.ref_no) s += 1
  if (rec.serial_no) s += 1
  if (rec.bought_from) s += 1
  if (rec.purchase_price) s += 1
  if (rec.sold_to) s += 1
  if (rec.sold_price) s += 1
  if (rec.image_url) s += 1
  return s
}

function loadInventoryMap(): Map<string, InventoryRecord> {
  if (cache) return cache

  const filePath = path.join(process.cwd(), 'data', 'inventory_all.csv')
  if (!fs.existsSync(filePath)) {
    cache = new Map()
    return cache
  }

  const text = fs.readFileSync(filePath, 'utf8')
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) {
    cache = new Map()
    return cache
  }

  const headers = parseCsvLine(lines[0])
  const idx = new Map<string, number>()
  headers.forEach((h, i) => idx.set(h.trim(), i))

  const map = new Map<string, InventoryRecord>()

  for (let li = 1; li < lines.length; li++) {
    const row = parseCsvLine(lines[li])
    const stockRaw = pick(row, idx, 'STOCK NUMBER', 'Stock No', 'Stock No.')
    if (!stockRaw) continue
    const stock_no = normalizeStockNo(stockRaw)
    if (!/^\d+$/.test(stock_no)) continue

    const rec: InventoryRecord = {
      stock_no,
      brand: pick(row, idx, 'Marca') || null,
      model: pick(row, idx, 'Model', 'Modello') || null,
      ref_no: pick(row, idx, 'Referenza', 'Reference', 'Reference No') || null,
      serial_no: pick(row, idx, 'Serial Number') || null,
      bought_from: pick(row, idx, 'Purchased From', 'Supplier Name') || null,
      sold_to: pick(row, idx, 'Sold To', 'Buyer Name', 'Client Name') || null,
      purchase_price: parseMoney(pick(row, idx, 'Purchase Price', 'Purchase Price (£)', 'Purchase Price (Â£)')),
      sold_price: parseMoney(pick(row, idx, 'Sold Price (£)', 'Sold Price (Â£)', 'Sold Price (A,A�)')),
      website_price: parseMoney(pick(row, idx, 'Website Price', 'Website Price (£)', 'Retail Price', 'Retail Price (£)')),
      watch_date: pick(row, idx, 'Watch Date') || null,
      payment_status: parsePaymentStatus(pick(row, idx, 'Payment Status')),
      image_url: pick(row, idx, 'Website Photo', 'Photo', 'PRODUCT PHOTO', 'Checkout Image') || null,
      category: pick(row, idx, 'Category') || null,
      currency: 'GBP',
    }

    const existing = map.get(stock_no)
    if (!existing || scoreRecord(rec) > scoreRecord(existing)) {
      map.set(stock_no, rec)
    }
  }

  cache = map
  return map
}

export function lookupInventoryByStockNo(stockNo: string | null | undefined): InventoryRecord | null {
  if (!stockNo) return null
  const key = normalizeStockNo(stockNo)
  if (!key) return null
  return loadInventoryMap().get(key) || null
}

export function enrichFromInventory<T extends {
  brand?: string | null
  model?: string | null
  ref_no?: string | null
  serial_no?: string | null
  bought_from?: string | null
  sold_to?: string | null
  price?: number | null
  currency?: string | null
  payment_status?: 'PAID' | 'PARTIAL' | 'NOT_PAID' | null
  watch_date?: string | null
  dial_colour?: string | null
  bracelet?: string | null
  case_material?: string | null
  image_url?: string | null
  website_price?: number | null
  location_to?: string | null
}>(data: T, stockNo: string | null | undefined, opts?: { preferSoldPrice?: boolean }): T & { inventory_matched?: boolean } {
  const inv = lookupInventoryByStockNo(stockNo)
  if (!inv) return data

  const out = { ...data, inventory_matched: true as const }

  if (!out.brand && inv.brand) out.brand = inv.brand
  if (!out.model && inv.model) out.model = inv.model
  if (!out.ref_no && inv.ref_no) out.ref_no = inv.ref_no
  if (!out.serial_no && inv.serial_no) out.serial_no = inv.serial_no
  if (!out.bought_from && inv.bought_from) out.bought_from = inv.bought_from
  if (!out.sold_to && inv.sold_to) out.sold_to = inv.sold_to
  if (!out.watch_date && inv.watch_date) out.watch_date = inv.watch_date
  if (!out.payment_status && inv.payment_status) out.payment_status = inv.payment_status
  if (!out.image_url && inv.image_url) out.image_url = inv.image_url
  if (!out.location_to && inv.category) out.location_to = inv.category
  if (!out.currency) out.currency = inv.currency

  if (opts?.preferSoldPrice) {
    if ((!out.price || out.price === 0) && inv.sold_price) out.price = inv.sold_price
  } else if ((!out.price || out.price === 0) && inv.purchase_price) {
    out.price = inv.purchase_price
  }

  if ((!out.website_price || out.website_price === 0) && inv.website_price) {
    out.website_price = inv.website_price
  }

  return out
}

export function inventoryLookupForApi(stockNo: string) {
  const inv = lookupInventoryByStockNo(stockNo)
  if (!inv) return null
  return {
    stock_no: inv.stock_no,
    brand: inv.brand,
    model: inv.model,
    ref_no: inv.ref_no,
    serial_no: inv.serial_no,
    bought_from: inv.bought_from,
    sold_to: inv.sold_to,
    purchase_price: inv.purchase_price,
    sold_price: inv.sold_price,
    website_price: inv.website_price,
    watch_date: inv.watch_date,
    payment_status: inv.payment_status,
    image_url: inv.image_url,
    category: inv.category,
    currency: inv.currency,
  }
}
