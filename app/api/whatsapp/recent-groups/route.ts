import { NextResponse } from 'next/server'
import { getRecentGroups } from '@/app/api/webhook/greenapi/route'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(getRecentGroups())
}
