import { resolveDirectBrandImage } from './brand-image-direct'

export type OfficialBrandConfig = {
  key: string
  domains: string[]
  searchDomain: string
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const OFFICIAL_BRANDS: OfficialBrandConfig[] = [
  { key: 'rolex', domains: ['rolex.com', 'content.rolex.com', 'media.rolex.com'], searchDomain: 'rolex.com' },
  { key: 'patek', domains: ['patek.com', 'static.patek.com', 'patek-res.cloudinary.com'], searchDomain: 'patek.com' },
  { key: 'audemars', domains: ['audemarspiguet.com'], searchDomain: 'audemarspiguet.com' },
  { key: 'omega', domains: ['omegawatches.com', 'omega.com'], searchDomain: 'omegawatches.com' },
  { key: 'iwc', domains: ['iwc.com'], searchDomain: 'iwc.com' },
  { key: 'tudor', domains: ['tudorwatch.com'], searchDomain: 'tudorwatch.com' },
  { key: 'hublot', domains: ['hublot.com'], searchDomain: 'hublot.com' },
  { key: 'cartier', domains: ['cartier.com'], searchDomain: 'cartier.com' },
  { key: 'panerai', domains: ['panerai.com'], searchDomain: 'panerai.com' },
  { key: 'jaeger', domains: ['jaeger-lecoultre.com'], searchDomain: 'jaeger-lecoultre.com' },
  { key: 'vacheron', domains: ['vacheron-constantin.com'], searchDomain: 'vacheron-constantin.com' },
  { key: 'breitling', domains: ['breitling.com'], searchDomain: 'breitling.com' },
  { key: 'tag heuer', domains: ['tagheuer.com'], searchDomain: 'tagheuer.com' },
  { key: 'richard mille', domains: ['richardmille.com'], searchDomain: 'richardmille.com' },
  { key: 'fp journe', domains: ['fpjourne.com', 'fpgenève.com'], searchDomain: 'fpjourne.com' },
  { key: 'a lange', domains: ['alange-soehne.com'], searchDomain: 'alange-soehne.com' },
]

const BLOCKED_PATH_RE = /\/bg\/|background|luminescence|fav_icon|favicon|logo|icon|sprite|banner|thumbnail|error|editorial|campaign|hero|lookbook|lifestyle|boutique/i
const LIFESTYLE_CDN_RE = /patek-res\.cloudinary\.com|cloudinary\.com.*\/(?:editorial|campaign|hero|lookbook)/i
const PREFERRED_PATH_RE = /upright|watch\.png|face_white|product-shot|packshot|gallery\/1000|appdpfeaturedsetting|appdpmain/i

export function matchOfficialBrand(brand: string | null | undefined): OfficialBrandConfig | null {
  if (!brand) return null
  const normalized = brand.toLowerCase().replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim()
  return OFFICIAL_BRANDS.find(({ key }) => normalized.includes(key)) || null
}

function normalizeRefToken(ref: string | null | undefined): string {
  return (ref || '').replace(/^ref\.?\s*/i, '').replace(/\s+/g, '').toLowerCase()
}

function refMatchesUrl(ref: string | null | undefined, url: string): boolean {
  const token = normalizeRefToken(ref)
  if (!token || token.length < 4) return false
  const compact = url.toLowerCase().replace(/[^a-z0-9]/g, '')
  const refCompact = token.replace(/[^a-z0-9]/g, '')
  return compact.includes(refCompact.slice(0, Math.min(refCompact.length, 10)))
}

export function normalizeOfficialImageUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (
      parsed.hostname.includes('content.rolex.com') ||
      parsed.hostname.includes('static.patek.com') ||
      parsed.hostname.includes('audemarspiguet.com')
    ) {
      parsed.search = ''
      return parsed.toString()
    }
  } catch {
    // keep original url
  }
  return url
}

export function scoreOfficialImage(
  url: string,
  ref: string | null | undefined,
  domains: string[],
  brandKey?: string,
): number {
  const lower = url.toLowerCase()
  let score = 0

  if (domains.some(domain => lower.includes(domain))) score += 100
  if (/\.png(?:$|[?#])/i.test(lower)) score += 60
  if (/\.webp(?:$|[?#])/i.test(lower)) score += 20
  if (/\.jpe?g(?:$|[?#])/i.test(lower)) score += 10
  if (PREFERRED_PATH_RE.test(lower)) score += 35
  if (/face_white\/\d+\//i.test(lower) && lower.includes('static.patek.com')) score += 45
  if (refMatchesUrl(ref, lower)) score += 40
  if (BLOCKED_PATH_RE.test(lower)) score -= 120
  if (LIFESTYLE_CDN_RE.test(lower)) score -= 150
  if (/transform\.appdpfeatured(case|dial|strap)/i.test(lower)) score -= 15
  if (brandKey === 'patek' && ref && !refMatchesUrl(ref, lower)) score -= 80

  return score
}

function buildOfficialQueries(
  brand: OfficialBrandConfig,
  ref: string | null | undefined,
  model: string | null | undefined,
): string[] {
  const refText = (ref || '').replace(/^ref\.?\s*/i, '').trim()
  const modelText = (model || '').trim()
  const queries = new Set<string>()

  if (refText) {
    if (brand.key === 'patek') {
      queries.add(`site:static.patek.com ${refText.replace(/\//g, '_').replace(/-/g, '_')} face_white`)
    }
    queries.add(`site:${brand.searchDomain} ${refText} png`)
    queries.add(`site:${brand.searchDomain} ${refText} watch png`)
    queries.add(`site:${brand.searchDomain} ${refText} watch`)
    queries.add(`site:${brand.searchDomain} ${refText}`)
  }
  if (modelText && refText) {
    queries.add(`site:${brand.searchDomain} ${modelText} ${refText} png`)
    queries.add(`${brand.searchDomain} ${modelText} ${refText} watch png`)
  }

  return Array.from(queries)
}

function pickBestCandidate(
  urls: string[],
  ref: string | null | undefined,
  domains: string[],
  brandKey?: string,
): string | null {
  const scored = urls
    .map(url => ({ url, score: scoreOfficialImage(url, ref, domains, brandKey) }))
    .filter(item => item.score >= 90)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const aRef = refMatchesUrl(ref, a.url) ? 1 : 0
      const bRef = refMatchesUrl(ref, b.url) ? 1 : 0
      if (bRef !== aRef) return bRef - aRef
      return a.url.localeCompare(b.url)
    })
  return scored[0]?.url || null
}

async function searchSerperImages(query: string, signal: AbortSignal): Promise<string[]> {
  const apiKey = process.env.SERPER_API_KEY?.trim()
  if (!apiKey) return []

  try {
    const res = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 10 }),
      signal,
    })
    if (!res.ok) return []

    const data = (await res.json()) as {
      images?: Array<{ imageUrl?: string; link?: string }>
    }
    return (data.images || [])
      .map(item => item.imageUrl?.trim() || '')
      .filter(url => /^https?:\/\//i.test(url))
  } catch {
    return []
  }
}

async function fetchBingImages(query: string, signal: AbortSignal): Promise<string[]> {
  try {
    const res = await fetch(
      `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`,
      {
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal,
      },
    )
    if (!res.ok) return []
    const html = await res.text()
    const urls: string[] = []
    const re = /"murl":"(https?:[^"]+)"/g
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) {
      try { urls.push(decodeURIComponent(m[1])) } catch { urls.push(m[1]) }
    }
    return urls
  } catch {
    return []
  }
}

async function searchWithProviders(
  queries: string[],
  ref: string | null | undefined,
  domains: string[],
  brandKey: string,
  signal: AbortSignal,
): Promise<string | null> {
  const hasSerper = !!process.env.SERPER_API_KEY?.trim()
  const providers = hasSerper
    ? [searchSerperImages, fetchBingImages]
    : [fetchBingImages, searchSerperImages]

  const candidates = new Set<string>()
  for (const query of queries) {
    for (const provider of providers) {
      const urls = await provider(query, signal)
      for (const url of urls) candidates.add(url)
    }
  }

  return pickBestCandidate(Array.from(candidates), ref, domains, brandKey)
}

export async function searchOfficialBrandImage(
  brandName: string | null | undefined,
  ref: string | null | undefined,
  model: string | null | undefined,
): Promise<string | null> {
  const brand = matchOfficialBrand(brandName)
  if (!brand) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)

  try {
    const directUrl = await resolveDirectBrandImage(brand.key, ref, model, controller.signal)
    if (directUrl) return directUrl

    const queries = buildOfficialQueries(brand, ref, model)
    if (queries.length === 0) return null

    const searched = await searchWithProviders(queries, ref, brand.domains, brand.key, controller.signal)
    return searched ? normalizeOfficialImageUrl(searched) : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchGenericWatchImage(
  brandName: string | null | undefined,
  model: string | null | undefined,
  ref: string | null | undefined,
): Promise<string | null> {
  const parts = [brandName, model, ref].filter(Boolean)
  if (parts.length === 0) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const query = `${parts.join(' ')} watch official`
    const urls = await fetchBingImages(query, controller.signal)
    const scored = urls
      .map(url => ({ url, score: scoreOfficialImage(url, ref, []) }))
      .filter(item => item.score > 0 && /\.(png|jpe?g|webp)($|\?)/i.test(item.url))
      .sort((a, b) => b.score - a.score)
    return scored[0]?.url || null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
