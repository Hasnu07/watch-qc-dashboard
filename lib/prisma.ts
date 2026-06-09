import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Supabase's poolers cap total clients (session pooler = 15). Prisma's default
// pool (cpu*2+1) plus any other connections can exhaust that, causing
// "FATAL: max clients reached" → 500s across the app (pending API, slideshow,
// etc.). Cap our pool small and add a queue timeout so requests wait for a free
// connection instead of failing. Applied by injecting params into the URL.
function buildDbUrl(): string | undefined {
  const raw = process.env.DATABASE_URL
  if (!raw) return raw
  try {
    const url = new URL(raw)
    if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', '5')
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '30')
    return url.toString()
  } catch {
    return raw
  }
}

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: { db: { url: buildDbUrl() } },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma

// Neon's free tier auto-suspends idle databases. The first request after idle
// can take 30+ seconds while compute cold-starts. This middleware catches the
// connection failures and retries with backoff so requests succeed once the DB
// wakes, instead of returning 500s to the user.
const COLD_START_PATTERNS = [
  /Can't reach database server/i,
  /Connection terminated/i,
  /connection.*timed out/i,
  /Server has closed the connection/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
  /ENOTFOUND/i,
  /EAI_AGAIN/i,
  // Supabase pooler client-limit exhaustion — transient; retry frees up.
  /max clients reached/i,
  /MaxClientsInSessionMode/i,
  /too many connections/i,
  /Timed out fetching a new connection from the connection pool/i,
]

function isColdStartError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true
  // P1001 = Can't reach database server (PrismaClientKnownRequestError in some paths)
  // P1002 = Database server reachable but timed out
  // P1017 = Server has closed the connection
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code
    if (code === 'P1001' || code === 'P1002' || code === 'P1017') return true
  }
  if (err instanceof Error) {
    return COLD_START_PATTERNS.some(re => re.test(err.message))
  }
  return false
}

basePrisma.$use(async (params, next) => {
  // ~35s total budget — covers Neon's worst observed cold start (~30s).
  // First few retries are quick; later ones space out to give compute time.
  const delays = [300, 800, 1500, 2500, 4000, 5500, 7000, 10000]
  let lastErr: unknown
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await next(params)
    } catch (err) {
      lastErr = err
      if (!isColdStartError(err) || attempt === delays.length) throw err
      const wait = delays[attempt]
      console.warn(`[Prisma] cold-start retry ${attempt + 1}/${delays.length} in ${wait}ms (${params.model}.${params.action}) — DB waking up`)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  throw lastErr
})

export const prisma = basePrisma
