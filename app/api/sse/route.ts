import { NextResponse } from 'next/server'
import { dashboardEvents } from '@/lib/events'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const encoder = new TextEncoder()
  let cleanup: (() => void) | null = null

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          )
        } catch {
          // Client disconnected
        }
      }

      // Send initial ping to confirm connection
      send({ type: 'connected' })

      // Keep-alive ping every 25 seconds
      const pingInterval = setInterval(() => {
        send({ type: 'ping', ts: Date.now() })
      }, 25000)

      const handler = (payload: unknown) => {
        send(payload)
      }

      dashboardEvents.on('dashboard', handler)

      cleanup = () => {
        clearInterval(pingInterval)
        dashboardEvents.off('dashboard', handler)
      }
    },
    cancel() {
      if (cleanup) cleanup()
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
