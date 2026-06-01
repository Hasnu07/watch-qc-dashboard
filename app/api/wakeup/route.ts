import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

// Lightweight endpoint an external uptime monitor (cron-job.org,
// UptimeRobot, etc.) can hit every 4-5 minutes to keep the Neon free-tier
// database warm. Without it, the DB suspends after idle and the next
// request can take 30+ seconds to wake up.
export async function GET() {
  const t0 = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true, ms: Date.now() - t0 })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      ms: Date.now() - t0,
      error: err instanceof Error ? err.message : 'unknown',
    }, { status: 503 })
  }
}
