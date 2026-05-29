import type { PendingWatchTask } from '@/lib/pending-dashboard'

export const ACCESSORY_GROUP_LABEL = 'Accessories'
export const ACCESSORY_GROUP_TASK_TYPE = 'LOGISTICS_ACCESSORIES'

export const ACCESSORY_TASK_TYPES = [
  'LOGISTICS_ACCESSORIES_BOX',
  'LOGISTICS_ACCESSORIES_PAPERS',
  'LOGISTICS_ACCESSORIES_EXTRA_LINKS',
  'LOGISTICS_ACCESSORIES_WARRANTY_CARD',
  'LOGISTICS_ACCESSORIES_HANG_TAG',
] as const

export type AccessoryTaskType = (typeof ACCESSORY_TASK_TYPES)[number]

export function isAccessoryTaskType(taskType: string): boolean {
  return (ACCESSORY_TASK_TYPES as readonly string[]).includes(taskType)
}

/** Count incomplete watch tasks; accessory sub-items count as one pending task. */
export function effectiveWatchPendingCount(tasks: Array<{ task_type: string }>): number {
  let count = 0
  let hasAccessory = false
  for (const t of tasks) {
    if (isAccessoryTaskType(t.task_type)) hasAccessory = true
    else count++
  }
  if (hasAccessory) count++
  return count
}

/** Collapse accessory sub-tasks into a single pending row per watch. */
export function collapseAccessoryPendingTasks(tasks: PendingWatchTask[]): PendingWatchTask[] {
  const main: PendingWatchTask[] = []
  const accessories: PendingWatchTask[] = []
  for (const t of tasks) {
    if (isAccessoryTaskType(t.task_type)) accessories.push(t)
    else main.push(t)
  }
  if (accessories.length === 0) return tasks

  const earliest = accessories.reduce((a, b) =>
    a.pipeline_started_at < b.pipeline_started_at ? a : b,
  )
  const grouped: PendingWatchTask = {
    id: earliest.id,
    task_type: ACCESSORY_GROUP_TASK_TYPE,
    label: ACCESSORY_GROUP_LABEL,
    department: 'LOGISTICS',
    phase: earliest.phase,
    pipeline_started_at: earliest.pipeline_started_at,
    is_blocking: false,
  }
  return [...main, grouped]
}

/** Deduplicate accessory labels when listing tasks for WhatsApp. */
export function labelsForTaskList(taskTypes: string[], labelFor: (taskType: string) => string): string[] {
  const labels: string[] = []
  let hasAccessory = false
  for (const taskType of taskTypes) {
    if (isAccessoryTaskType(taskType)) {
      hasAccessory = true
      continue
    }
    labels.push(labelFor(taskType))
  }
  if (hasAccessory) labels.push(ACCESSORY_GROUP_LABEL)
  return labels
}
