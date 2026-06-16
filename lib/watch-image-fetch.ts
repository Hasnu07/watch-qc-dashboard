import { lookupInventoryByStockNo } from './inventory-csv'
import { prisma } from './prisma'
import { searchOfficialBrandImage, normalizeOfficialImageUrl } from './official-watch-images'

export type ImageSource =
  | 'inventory'
  | 'linked_buy'
  | 'sibling_watch'
  | 'official_brand'
  | 'existing'

export type WatchImageLookup = {
  id: number
  image_url?: string | null
  stock_no?: string | null
  brand?: string | null
  model?: string | null
  ref_no?: string | null
  linked_buy_watch_id?: number | null
}

export async function findWatchImageUrl(
  watch: WatchImageLookup,
  opts?: { force?: boolean },
): Promise<{ url: string; source: ImageSource } | null> {
  if (watch.image_url && !opts?.force) {
    return { url: watch.image_url, source: 'existing' }
  }

  if (opts?.force) {
    const officialUrl = await searchOfficialBrandImage(watch.brand, watch.ref_no, watch.model)
    if (officialUrl) {
      return { url: normalizeOfficialImageUrl(officialUrl), source: 'official_brand' }
    }
    return null
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

  const officialUrl = await searchOfficialBrandImage(watch.brand, watch.ref_no, watch.model)
  if (officialUrl) {
    return { url: normalizeOfficialImageUrl(officialUrl), source: 'official_brand' }
  }

  // Generic Bing fallback when brand is unknown or not in our brand list
  if (watch.model || watch.ref_no) {
    const { fetchGenericWatchImage } = await import('./official-watch-images')
    const genericUrl = await fetchGenericWatchImage(watch.brand, watch.model, watch.ref_no)
    if (genericUrl) return { url: genericUrl, source: 'official_brand' }
  }

  return null
}
