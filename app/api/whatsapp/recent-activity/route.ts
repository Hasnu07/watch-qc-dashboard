import { NextResponse } from 'next/server'
import { getRecentHits } from '@/app/api/webhook/greenapi/route'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(getRecentHits())
}
