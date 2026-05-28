import { NextRequest, NextResponse } from 'next/server'
import { importWatchFromMessage } from '@/lib/import-watch-from-message'

// Manual catcher endpoint — paste a WhatsApp message body (with optional
// image URL) and we'll AI-parse it and create the watch, same as the
// webhook would have. Used by the dashboard's "Paste Message" modal.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const text = String(body.text || '')
    const imageUrl = body.imageUrl ? String(body.imageUrl) : undefined

    if (!text.trim() && !imageUrl) {
      return NextResponse.json({ error: 'Provide text or imageUrl' }, { status: 400 })
    }

    const result = await importWatchFromMessage(text, imageUrl)
    if (!result.imported) {
      return NextResponse.json({
        imported: false,
        skipped: result.skipped,
        parsed: result.parsed,
      }, { status: 200 })
    }
    return NextResponse.json({
      imported: true,
      watch: result.watch,
      watch_type: result.watchType,
      parsed: result.parsed,
      inventory_matched: result.inventory_matched,
    }, { status: 201 })
  } catch (err) {
    console.error('[import-from-message]', err)
    return NextResponse.json({ error: 'Failed to import' }, { status: 500 })
  }
}
