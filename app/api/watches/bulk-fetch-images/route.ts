import { NextResponse } from 'next/server'
import { getBulkFetchStatus, startBulkImageFetch } from '@/lib/bulk-image-fetch'

export async function GET() {
  return NextResponse.json(getBulkFetchStatus())
}

export async function POST() {
  const result = await startBulkImageFetch()
  return NextResponse.json({ ...result, status: getBulkFetchStatus() })
}
