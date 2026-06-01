import { PrismaClient, Prisma } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma

// Neon's free tier auto-suspends idle databases. The first request after idle
// fails with "Can't reach database server" while it cold-starts. This middleware
// retries those specific connection-init failures with backoff so the user
// doesn't see a 500 — they just wait ~1-3 seconds extra on the first request.
const COLD_START_PATTERNS = [
  /Can't reach database server/i,
  /Connection terminated/i,
  /connection.*timed out/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
]

function isColdStartError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true
  if (err instanceof Error) {
    return COLD_START_PATTERNS.some(re => re.test(err.message))
  }
  return false
}

basePrisma.$use(async (params, next) => {
  const delays = [400, 1000, 2000, 3500, 5000] // 5 retries, ~12s total worst case
  let lastErr: unknown
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await next(params)
    } catch (err) {
      lastErr = err
      if (!isColdStartError(err) || attempt === delays.length) throw err
      const wait = delays[attempt]
      console.warn(`[Prisma] cold-start retry ${attempt + 1}/${delays.length} after ${wait}ms (${params.model}.${params.action})`)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  throw lastErr
})

export const prisma = basePrisma
