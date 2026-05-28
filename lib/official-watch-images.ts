export type OfficialBrandConfig = {
  key: string
  domains: string[]
  searchDomain: string
}

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

const BLOCKED_PATH_RE = /\/bg\/|background|luminescence|fav_icon|favicon|logo|icon|sprite|banner|thumbnail/i
const PREFERRED_PATH_RE = /upright|watch\.png|face_white|product-shot|packshot|gallery\/1000|appdpfeaturedsetting/i

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

export function scoreOfficialImage(url: string, ref: string | null | undefined, domains: string[]): number {
  const lower = url.toLowerCase()
  let score = 0

  if (domains.some(domain => lower.includes(domain))) score += 100
  if (/\.png(?:$|[?#])/i.test(lower)) score += 60
  if (/\.webp(?:$|[?#])/i.test(lower)) score += 20
  if (/\.jpe?g(?:$|[?#])/i.test(lower)) score += 10
  if (PREFERRED_PATH_RE.test(lower)) score += 35
  if (refMatchesUrl(ref, lower)) score += 25
  if (BLOCKED_PATH_RE.test(lower)) score -= 120
  if (/transform\.appdpfeatured(case|dial|strap)/i.test(lower)) score -= 15

  return score
}

async function fetchDdgImages(query: string, signal: AbortSignal): Promise<Array<{ image: string; title?: string }>> {
  const searchRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PurosangueQC/1.0)' },
    signal,
  })
  if (!searchRes.ok) return []

  const html = await searchRes.text()
  const vqdMatch = html.match(/vqd=["']?([\d-]+)/)
  if (!vqdMatch) return []

  const imageRes = await fetch(
    `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqdMatch[1]}&f=,,,,,&p=1`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PurosangueQC/1.0)',
        Referer: 'https://duckduckgo.com/',
      },
      signal,
    },
  )
  if (!imageRes.ok) return []

  const data = (await imageRes.json()) as { results?: Array<{ image?: string; title?: string }> }
  return (data.results || [])
    .map(result => ({ image: result.image?.trim() || '', title: result.title }))
    .filter(result => /^https?:\/\//i.test(result.image))
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
    queries.add(`site:${brand.searchDomain} ${refText} png`)
    queries.add(`site:${brand.searchDomain} ${refText} watch png`)
    queries.add(`site:${brand.searchDomain} ${refText}`)
  }
  if (modelText && refText) {
    queries.add(`site:${brand.searchDomain} ${modelText} ${refText} png`)
  }

  return Array.from(queries)
}

export async function searchOfficialBrandImage(
  brandName: string | null | undefined,
  ref: string | null | undefined,
  model: string | null | undefined,
): Promise<string | null> {
  const brand = matchOfficialBrand(brandName)
  if (!brand) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const queries = buildOfficialQueries(brand, ref, model)
    const candidates: Array<{ url: string; score: number }> = []

    for (const query of queries) {
      const results = await fetchDdgImages(query, controller.signal)
      for (const result of results) {
        const score = scoreOfficialImage(result.image, ref, brand.domains)
        if (score >= 90) candidates.push({ url: result.image, score })
      }
      const best = candidates.sort((a, b) => b.score - a.score)[0]
      if (best && best.score >= 140) break
    }

    candidates.sort((a, b) => b.score - a.score)
    const top = candidates[0]
    return top?.score >= 90 ? top.url : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
