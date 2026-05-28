import { NextResponse } from 'next/server'
import { listPendingImportInbox } from '@/lib/import-inbox'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const items = await listPendingImportInbox(50)
    return NextResponse.json(items)
  } catch {
    return NextResponse.json([])
  }
}
