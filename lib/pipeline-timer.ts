export const PIPELINE_TIMER_EPOCH_KEY = 'pipeline_timer_epoch'
export const PIPELINE_INITIAL_OFFSET_MS = 24 * 60 * 60 * 1000
export const PIPELINE_SLA_HOURS = 24

/** Tasks created before the feature epoch show 24h elapsed at rollout; new tasks start at zero. */
export function pipelineStartedAt(createdAt: Date, epoch: Date): Date {
  if (createdAt.getTime() >= epoch.getTime()) return createdAt
  return new Date(epoch.getTime() - PIPELINE_INITIAL_OFFSET_MS)
}

export function formatPipelineElapsed(startedAt: Date, now = new Date()): string {
  const ms = Math.max(0, now.getTime() - startedAt.getTime())
  const totalMins = Math.floor(ms / 60_000)
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60

  if (h >= 24) {
    const d = Math.floor(h / 24)
    const rh = h % 24
    return rh > 0 ? `${d}d ${rh}h` : `${d}d`
  }
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`
  if (totalMins < 1) return '<1m'
  return `${totalMins}m`
}

export function isOverPipelineSla(
  startedAt: Date,
  now = new Date(),
  slaHours = PIPELINE_SLA_HOURS,
): boolean {
  return now.getTime() - startedAt.getTime() >= slaHours * 60 * 60 * 1000
}
