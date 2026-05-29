export type ImageQuality = 'Official' | 'From buy' | 'WhatsApp' | 'Missing'

const OFFICIAL_HOSTS = [
  'content.rolex.com',
  'static.patek.com',
  'patek.com',
  'omegawatches.com',
  'omega.com',
  'audemarspiguet.com',
  'images.audemarspiguet.com',
  'cartier.com',
  'media.richardmille.com',
]

function isOfficialUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return OFFICIAL_HOSTS.some(h => host === h || host.endsWith(`.${h}`))
  } catch {
    return OFFICIAL_HOSTS.some(h => url.toLowerCase().includes(h))
  }
}

function isWhatsAppUrl(url: string): boolean {
  const lower = url.toLowerCase()
  return (
    lower.includes('whatsapp') ||
    lower.includes('green-api') ||
    lower.includes('greenapi') ||
    lower.includes('mmg.whatsapp.net') ||
    lower.includes('pps.whatsapp.net')
  )
}

export function getImageQuality(
  watch: {
    image_url?: string | null
    watch_type?: string | null
    linked_buy_watch_id?: number | null
    linked_buy_image_url?: string | null
  },
): ImageQuality {
  if (!watch.image_url) return 'Missing'

  if (isOfficialUrl(watch.image_url)) return 'Official'

  if (
    watch.watch_type === 'SELL' &&
    watch.linked_buy_watch_id &&
    watch.linked_buy_image_url &&
    watch.image_url === watch.linked_buy_image_url
  ) {
    return 'From buy'
  }

  if (isWhatsAppUrl(watch.image_url)) return 'WhatsApp'

  // Sell linked to buy but image copied without exact URL match
  if (watch.watch_type === 'SELL' && watch.linked_buy_watch_id && !isOfficialUrl(watch.image_url)) {
    return 'From buy'
  }

  return 'WhatsApp'
}
