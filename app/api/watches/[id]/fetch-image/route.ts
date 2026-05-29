import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitWatchEvent } from '@/lib/events'
import { findWatchImageUrl } from '@/lib/watch-image-fetch'
import { logWatchActivity } from '@/lib/watch-activity'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const id = parseInt(params.id, 10)
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid watch id' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const force = !!(body as { force?: boolean }).force

    const watch = await prisma.watch.findUnique({ where: { id } })
    if (!watch) {
      return NextResponse.json({ error: 'Watch not found' }, { status: 404 })
    }

    const found = await findWatchImageUrl(watch, { force })
    if (!found) {
      return NextResponse.json({
        error: 'No official brand image found. Set brand + reference, add SERPER_API_KEY for better search, or paste an image URL manually.',
      }, { status: 404 })
    }

    if (found.source === 'existing') {
      return NextResponse.json({ image_url: found.url, source: found.source, watch })
    }

    const updated = await prisma.watch.update({
      where: { id },
      data: { image_url: found.url },
    })

    logWatchActivity(id, 'image_fetched', found.source).catch(console.error)
    emitWatchEvent({ type: 'watch_updated', watchId: id })

    return NextResponse.json({
      image_url: found.url,
      source: found.source,
      watch: updated,
    })
  } catch (err) {
    console.error('[fetch-image]', err)
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 500 })
  }
}
