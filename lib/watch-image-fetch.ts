import { lookupInventoryByStockNo } from './inventory-csv'
import { prisma } from './prisma'

export type ImageSource = 'inventory' | 'linked_buy' | 'sibling_watch' | 'web_search' | 'existing'

export type WatchImageLookup = {
  id: number
  image_url?: string | null
  stock_no?: string | null
  brand?: string | null
  model?: string | null
  ref_no?: string | null
  linked_buy_watch_id?: number | null
}

function buildSearchQuery(watch: WatchImageLookup): string | null {
  const parts = [watch.brand, watch.model, watch.ref_no?.replace(/^ref\.?\s*/i, '')]
    .map(p => (p || '').trim())
    .filter(Boolean)
  if (parts.length === 0) return null
  return `${parts.join(' ')} watch`
}

async function searchWebImage(query: string): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)

  try {
    const searchRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PurosangueQC/1.0)' },
      signal: controller.signal,
    })
    if (!searchRes.ok) return null

    const html = await searchRes.text()
    const vqdMatch = html.match(/vqd=["']?([\d-]+)/)
    if (!vqdMatch) return null

    const imageRes = await fetch(
      `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqdMatch[1]}&f=,,,,,&p=1`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PurosangueQC/1.0)',
          Referer: 'https://duckduckgo.com/',
        },
        signal: controller.signal,
      },
    )
    if (!imageRes.ok) return null

    const data = (await imageRes.json()) as { results?: Array<{ image?: string }> }
    for (const result of data.results || []) {
      const url = result.image?.trim()
      if (url && /^https?:\/\//i.test(url)) return url
    }
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function findWatchImageUrl(
  watch: WatchImageLookup,
): Promise<{ url: string; source: ImageSource } | null> {
  if (watch.image_url) {
    return { url: watch.image_url, source: 'existing' }
  }

  if (watch.stock_no) {
    const inv = lookupInventoryByStockNo(watch.stock_no)
    if (inv?.image_url) {
      return { url: inv.image_url, source: 'inventory' }
    }
  }

  if (watch.linked_buy_watch_id) {
    const linked = await prisma.watch.findUnique({
      where: { id: watch.linked_buy_watch_id },
      select: { image_url: true },
    })
    if (linked?.image_url) {
      return { url: linked.image_url, source: 'linked_buy' }
    }
  }

  if (watch.stock_no) {
    const sibling = await prisma.watch.findFirst({
      where: {
        stock_no: watch.stock_no,
        id: { not: watch.id },
        image_url: { not: null },
      },
      orderBy: { updated_at: 'desc' },
      select: { image_url: true },
    })
    if (sibling?.image_url) {
      return { url: sibling.image_url, source: 'sibling_watch' }
    }
  }

  const query = buildSearchQuery(watch)
  if (query) {
    const webUrl = await searchWebImage(query)
    if (webUrl) return { url: webUrl, source: 'web_search' }
  }

  return null
}
