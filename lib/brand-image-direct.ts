const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const ROLEX_YEAR_FOLDERS = [
  '2026-06', '2026-01', '2025-06', '2025-01', '2024-06', '2024-01', '2023-06', '2022-06',
]

export function rolexRefVariants(ref: string | null | undefined): string[] {
  const raw = (ref || '').replace(/^ref\.?\s*/i, '').trim().toLowerCase()
  if (!raw) return []

  const variants = new Set<string>([raw])
  const compact = raw.replace(/[^a-z0-9]/g, '')

  if (raw.startsWith('m') && raw.includes('-')) {
    variants.add(raw)
  } else if (raw.startsWith('m')) {
    for (let i = 1; i <= 4; i++) variants.add(`${raw}-${String(i).padStart(4, '0')}`)
  } else if (/^\d+[a-z]{2,}/.test(compact)) {
    const withM = `m${compact}`
    variants.add(withM)
    for (let i = 1; i <= 4; i++) variants.add(`${withM}-${String(i).padStart(4, '0')}`)
  }

  if (/-\d{4}$/.test(raw) && !raw.startsWith('m')) {
    variants.add(`m${compact}`)
  }

  return Array.from(variants)
}

async function urlReturnsImage(url: string, signal: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': BROWSER_UA, Range: 'bytes=0-512' },
      signal,
      redirect: 'follow',
    })
    if (!res.ok) return false
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    return ct.startsWith('image/')
  } catch {
    return false
  }
}

function buildRolexCandidateUrls(ref: string | null | undefined): string[] {
  const tokens = rolexRefVariants(ref).sort((a, b) => {
    const aSuffix = /-\d{4}$/.test(a) ? 1 : 0
    const bSuffix = /-\d{4}$/.test(b) ? 1 : 0
    return bSuffix - aSuffix || b.length - a.length
  })

  const urls: string[] = []
  for (const token of tokens) {
    for (const year of ROLEX_YEAR_FOLDERS) {
      urls.push(`https://content.rolex.com/v7/dam/${year}/upright-c/${token}.png`)
    }
  }
  for (const token of tokens) {
    for (const year of ROLEX_YEAR_FOLDERS) {
      urls.push(`https://content.rolex.com/v7/dam/${year}/upright-bba-with-shadow/${token}.png`)
    }
  }
  return urls
}

async function resolveRolexImage(ref: string | null | undefined, signal: AbortSignal): Promise<string | null> {
  const urls = buildRolexCandidateUrls(ref)
  const batchSize = 10

  for (let i = 0; i < urls.length; i += batchSize) {
    if (signal.aborted) return null
    const batch = urls.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map(async url => ((await urlReturnsImage(url, signal)) ? url : null)),
    )
    const hit = results.find(Boolean)
    if (hit) return hit
  }

  return null
}

function omegaSlugVariants(ref: string | null | undefined, model: string | null | undefined): string[] {
  const refText = (ref || '').replace(/[^a-z0-9.]/gi, '').toLowerCase()
  if (!refText) return []

  const modelSlug = (model || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  const dashedRef = refText.replace(/\./g, '-')
  const slugs = new Set<string>()
  if (modelSlug) slugs.add(`${modelSlug}-${dashedRef}`)
  slugs.add(`omega-${dashedRef}`)
  slugs.add(dashedRef)
  return Array.from(slugs)
}

async function resolveOmegaImage(
  ref: string | null | undefined,
  model: string | null | undefined,
  signal: AbortSignal,
): Promise<string | null> {
  for (const slug of omegaSlugVariants(ref, model)) {
    const letters = slug.replace(/[^a-z0-9]/g, '').slice(0, 2) || 'om'
    const url = `https://www.omegawatches.com/media/catalog/product/${letters[0]}/${letters[1] || letters[0]}/${slug}.png`
    if (await urlReturnsImage(url, signal)) return url
  }
  return null
}

function patekRefToken(ref: string | null | undefined): string | null {
  const raw = (ref || '').replace(/^ref\.?\s*/i, '').trim()
  if (!raw) return null
  return raw.replace(/\//g, '_').replace(/-/g, '_')
}

function patekFolderCandidates(ref: string | null | undefined): number[] {
  const first = parseInt((ref || '').split(/[/_-]/)[0], 10)
  const folders = new Set<number>([350, 300, 400, 250])
  if (Number.isFinite(first)) folders.add(first)
  return Array.from(folders)
}

function buildPatekCandidateUrls(ref: string | null | undefined): string[] {
  const token = patekRefToken(ref)
  if (!token) return []

  const urls: string[] = []
  for (const folder of patekFolderCandidates(ref)) {
    for (const suffix of ['_1.png', '_1.jpg', '.png', '.jpg']) {
      urls.push(`https://static.patek.com/images/articles/face_white/${folder}/${token}${suffix}`)
    }
  }
  return urls
}

async function resolvePatekImage(ref: string | null | undefined, signal: AbortSignal): Promise<string | null> {
  const urls = buildPatekCandidateUrls(ref)
  const batchSize = 8

  for (let i = 0; i < urls.length; i += batchSize) {
    if (signal.aborted) return null
    const batch = urls.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map(async url => ((await urlReturnsImage(url, signal)) ? url : null)),
    )
    const pngHit = results.find(url => url?.includes('.png'))
    if (pngHit) return pngHit
    const hit = results.find(Boolean)
    if (hit) return hit
  }

  return null
}

export async function resolveDirectBrandImage(
  brandKey: string,
  ref: string | null | undefined,
  model: string | null | undefined,
  signal: AbortSignal,
): Promise<string | null> {
  if (brandKey === 'rolex') return resolveRolexImage(ref, signal)
  if (brandKey === 'patek') return resolvePatekImage(ref, signal)
  if (brandKey === 'omega') return resolveOmegaImage(ref, model, signal)
  return null
}
