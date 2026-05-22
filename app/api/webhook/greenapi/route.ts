import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // WhatsApp is now outbound-only. Log incoming messages silently.
    if (body.typeWebhook === 'incomingMessageReceived') {
      const sender = body.senderData?.sender || ''
      const text = body.messageData?.textMessageData?.textMessage || ''
      console.log(`[Webhook] Incoming message from ${sender}: "${String(text).slice(0, 60)}"`)
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}
