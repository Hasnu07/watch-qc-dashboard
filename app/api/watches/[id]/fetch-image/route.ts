import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { emitWatchEvent } from '@/lib/events'
import { findWatchImageUrl } from '@/lib/watch-image-fetch'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const id = parseInt(params.id, 10)
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'Invalid watch id' }, { status: 400 })
    }

    const watch = await prisma.watch.findUnique({ where: { id } })
    if (!watch) {
      return NextResponse.json({ error: 'Watch not found' }, { status: 404 })
    }

    const found = await findWatchImageUrl(watch)
    if (!found) {
      return NextResponse.json({ error: 'No image found for this watch' }, { status: 404 })
    }

    if (found.source === 'existing') {
      return NextResponse.json({ image_url: found.url, source: found.source, watch })
    }

    const updated = await prisma.watch.update({
      where: { id },
      data: { image_url: found.url },
    })

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
