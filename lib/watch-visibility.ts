import { prisma } from './prisma'

type WatchRow = { id: number; watch_type: string }

/** Phase used for dashboard task tracking — BUY inventory vs SELL deal entries. */
export function activePhaseForWatch(watchType: string): 'BUY' | 'SELL' {
  return watchType === 'SELL' ? 'SELL' : 'BUY'
}

export function taskMatchesPhase(taskPhase: string, watchPhase: 'BUY' | 'SELL'): boolean {
  return watchPhase === 'SELL' ? taskPhase === 'SELL' : taskPhase !== 'SELL'
}

/**
 * A watch stays on the dashboard until every task in its active phase is complete.
 * Watches with no tasks yet remain visible (tasks may still be creating).
 */
export function isWatchVisible(
  watch: WatchRow,
  tasks: Array<{ watch_id: number; phase: string; is_completed: boolean }>,
): boolean {
  const phase = activePhaseForWatch(watch.watch_type)
  const relevant = tasks.filter(t => t.watch_id === watch.id && taskMatchesPhase(t.phase, phase))
  if (relevant.length === 0) return true
  return relevant.some(t => !t.is_completed)
}

export async function getVisibleWatches() {
  const watches = await prisma.watch.findMany({ orderBy: { created_at: 'desc' } })
  if (watches.length === 0) return []

  const tasks = await prisma.watchTask.findMany({
    where: { watch_id: { in: watches.map(w => w.id) } },
    select: { watch_id: true, phase: true, is_completed: true },
  })

  return watches.filter(w => isWatchVisible(w, tasks))
}

export async function visibleWatchFilter() {
  const visible = await getVisibleWatches()
  const ids = visible.map(w => w.id)
  if (ids.length === 0) return { id: { in: [-1] } } // match nothing
  return { id: { in: ids } }
}
