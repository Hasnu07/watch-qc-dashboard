import { prisma } from './prisma'

export async function logWatchActivity(
  watchId: number,
  action: string,
  detail?: string | null,
  actor?: string | null,
) {
  try {
    await prisma.watchActivity.create({
      data: { watch_id: watchId, action, detail: detail || null, actor: actor || null },
    })
  } catch (err) {
    console.error('[WatchActivity]', err)
  }
}

export async function getWatchActivities(watchId: number, limit = 50) {
  return prisma.watchActivity.findMany({
    where: { watch_id: watchId },
    orderBy: { created_at: 'desc' },
    take: limit,
  })
}
