import { NextResponse } from 'next/server'
import { getRecentHits } from '@/lib/webhook-activity'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(getRecentHits())
}
