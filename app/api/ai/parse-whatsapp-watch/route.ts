import { NextRequest, NextResponse } from 'next/server'
import { parseWhatsAppWatch } from '@/lib/parse-whatsapp-watch'

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text required' }, { status: 400 })
    }
    const parsed = await parseWhatsAppWatch(text)
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[AI parse-whatsapp-watch]', err)
    return NextResponse.json({ should_import: false }, { status: 200 })
  }
}
