import {
  formatPipelineElapsed,
  getPipelineUrgency,
  isOverPipelineSla,
  type PipelineUrgency,
} from '@/lib/pipeline-timer'
import { SELL_BLOCKING_TASK_LABELS } from '@/lib/sell-tasks'

export type PendingFilter = 'all' | 'overdue' | 'due_soon'
export type PendingView = 'people' | 'queue'

export const BLOCKING_TASK_TYPES = new Set([
  'ACCOUNTING_MARK_PAYMENT',
  'LOGISTICS_SET_LOCATION',
])

export function isBlockingWatchTask(taskType: string, phase: string): boolean {
  if (BLOCKING_TASK_TYPES.has(taskType)) return true
  if (phase === 'SELL' && SELL_BLOCKING_TASK_LABELS.has(taskType)) return true
  return false
}

export interface PendingWatchTask {
  id: number
  task_type: string
  label: string
  department: string
  phase: string
  pipeline_started_at: string
  is_blocking: boolean
}

export interface PendingWatchGroup {
  watch_id: number
  watch_label: string
  stock_no: string | null
  phase: string
  tasks: PendingWatchTask[]
}

export interface PendingTeamTask {
  id: number
  message_text: string
  date: string
  created_at: string
  pipeline_started_at: string
}

export interface MemberPending {
  member: { id: number; name: string; department: string }
  pending_count: number
  overdue_count: number
  due_soon_count: number
  team_tasks: PendingTeamTask[]
  watch_groups: PendingWatchGroup[]
}

export interface UnassignedPending {
  pending_count: number
  overdue_count: number
  due_soon_count: number
  team_tasks: PendingTeamTask[]
  watch_groups: PendingWatchGroup[]
}

export interface PendingSummary {
  total_pending: number
  overdue_count: number
  due_soon_count: number
  unassigned_count: number
  cleared_24h: number
  oldest_overdue_label: string
  by_department: { ACCOUNTING: number; SALES: number; LOGISTICS: number }
  health_score: number
  health_label: string
}

export interface PendingDashboardResponse {
  summary: PendingSummary
  members: MemberPending[]
  unassigned: UnassignedPending
}

export function healthLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  return 'Needs attention'
}

export function computeHealthScore(totalPending: number, overdueCount: number, unassignedCount: number): number {
  if (totalPending === 0) return 100
  const onTrack = totalPending - overdueCount
  let score = Math.round((onTrack / totalPending) * 100)
  if (unassignedCount > 0) score = Math.max(0, score - 5)
  return score
}

export function taskUrgency(startedAt: string, now: Date): PipelineUrgency {
  return getPipelineUrgency(new Date(startedAt), now)
}

export function countUrgencyForBucket(
  teamTasks: PendingTeamTask[],
  watchGroups: PendingWatchGroup[],
  now: Date,
): { overdue: number; due_soon: number } {
  let overdue = 0
  let due_soon = 0
  const tally = (startedAt: string) => {
    const u = taskUrgency(startedAt, now)
    if (u === 'overdue') overdue++
    else if (u === 'warning') due_soon++
  }
  for (const t of teamTasks) tally(t.pipeline_started_at)
  for (const g of watchGroups) {
    for (const t of g.tasks) tally(t.pipeline_started_at)
  }
  return { overdue, due_soon }
}

export function maxOverdueLabel(
  items: Array<{ pipeline_started_at: string }>,
  now: Date,
): string {
  let maxMs = 0
  for (const item of items) {
    const start = new Date(item.pipeline_started_at)
    if (!isOverPipelineSla(start, now)) continue
    const ms = now.getTime() - start.getTime()
    if (ms > maxMs) maxMs = ms
  }
  if (maxMs === 0) return '—'
  return formatPipelineElapsed(new Date(now.getTime() - maxMs), now)
}

export function memberMatchesFilter(
  member: MemberPending,
  filter: PendingFilter,
): boolean {
  if (filter === 'all') return true
  if (filter === 'overdue') return member.overdue_count > 0
  if (filter === 'due_soon') return member.due_soon_count > 0
  return true
}

export function unassignedMatchesFilter(
  unassigned: UnassignedPending,
  filter: PendingFilter,
): boolean {
  if (filter === 'all') return unassigned.pending_count > 0
  if (filter === 'overdue') return unassigned.overdue_count > 0
  if (filter === 'due_soon') return unassigned.due_soon_count > 0
  return false
}
