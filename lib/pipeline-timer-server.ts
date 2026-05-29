import { prisma } from './prisma'
import { PIPELINE_TIMER_EPOCH_KEY, pipelineStartedAt } from './pipeline-timer'

export async function getOrInitPipelineTimerEpoch(): Promise<Date> {
  const existing = await prisma.setting.findUnique({ where: { key: PIPELINE_TIMER_EPOCH_KEY } })
  if (existing?.value) return new Date(existing.value)

  const now = new Date()
  await prisma.setting.upsert({
    where: { key: PIPELINE_TIMER_EPOCH_KEY },
    create: { key: PIPELINE_TIMER_EPOCH_KEY, value: now.toISOString() },
    update: {},
  })
  return now
}

export function pipelineStartedAtIso(createdAt: Date, epoch: Date): string {
  return pipelineStartedAt(createdAt, epoch).toISOString()
}
