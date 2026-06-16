import { NextResponse } from 'next/server'
import { listPendingImportInbox, dismissAllImportInbox } from '@/lib/import-inbox'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const items = await listPendingImportInbox(50)
    return NextResponse.json(items)
  } catch {
    return NextResponse.json([])
  }
}

export async function DELETE() {
  try {
    const { count } = await dismissAllImportInbox()
    return NextResponse.json({ ok: true, dismissed: count })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
