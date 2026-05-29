import { prisma } from './prisma'
import { emitWatchEvent } from './events'
import { findWatchImageUrl } from './watch-image-fetch'
import { logWatchActivity } from './watch-activity'

const DELAY_MS = 2500
const MAX_PER_RUN = 40

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export type BulkFetchStatus = {
  running: boolean
  queued: number
  done: number
  failed: number
  started_at: number | null
}

let status: BulkFetchStatus = {
  running: false,
  queued: 0,
  done: 0,
  failed: 0,
  started_at: null,
}

export function getBulkFetchStatus(): BulkFetchStatus {
  return { ...status }
}

export async function startBulkImageFetch(): Promise<{ started: boolean; queued: number; message?: string }> {
  if (status.running) {
    return { started: false, queued: status.queued, message: 'Bulk fetch already running' }
  }

  const watches = await prisma.watch.findMany({
    where: { OR: [{ image_url: null }, { image_url: '' }] },
    select: {
      id: true,
      stock_no: true,
      brand: true,
      model: true,
      ref_no: true,
      linked_buy_watch_id: true,
      image_url: true,
    },
    orderBy: { created_at: 'desc' },
    take: MAX_PER_RUN,
  })

  if (watches.length === 0) {
    return { started: false, queued: 0, message: 'No watches missing images' }
  }

  status = { running: true, queued: watches.length, done: 0, failed: 0, started_at: Date.now() }

  void (async () => {
    try {
      for (const watch of watches) {
        try {
          const found = await findWatchImageUrl(watch)
          if (found && found.source !== 'existing') {
            await prisma.watch.update({
              where: { id: watch.id },
              data: { image_url: found.url },
            })
            await logWatchActivity(watch.id, 'image_fetched', `Bulk ${found.source}`)
            emitWatchEvent({ type: 'watch_updated', watchId: watch.id })
            status.done++
          } else {
            status.failed++
          }
        } catch (err) {
          console.error('[bulk-image-fetch] watch', watch.id, err)
          status.failed++
        }
        await sleep(DELAY_MS)
      }
    } finally {
      status.running = false
    }
  })()

  return { started: true, queued: watches.length }
}
