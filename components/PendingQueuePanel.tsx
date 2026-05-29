'use client'

import { useMemo, useState } from 'react'
import { formatPipelineElapsed, getPipelineUrgency, type PipelineUrgency } from '@/lib/pipeline-timer'
import type {
  MemberPending,
  PendingFilter,
  UnassignedPending,
} from '@/lib/pending-dashboard'
import { taskUrgency } from '@/lib/pending-dashboard'

const URGENCY_LABELS: Record<PipelineUrgency, string> = {
  fresh: 'Waiting',
  warning: 'Due soon',
  overdue: 'Overdue',
}

const URGENCY_CLASS: Record<PipelineUrgency, string> = {
  fresh: 'task-strip-fresh',
  warning: 'task-strip-warning',
  overdue: 'task-strip-overdue',
}

const URGENCY_ORDER: Record<PipelineUrgency, number> = {
  overdue: 0,
  warning: 1,
  fresh: 2,
}

interface QueueItem {
  key: string
  title: string
  subtitle?: string | null
  assignee: string
  startedAt: string
  isBlocking: boolean
  watchId?: number
  phase?: 'BUY' | 'SELL'
  teamTaskId?: number
}

function buildQueueItems(
  members: MemberPending[],
  unassigned: UnassignedPending,
): QueueItem[] {
  const items: QueueItem[] = []

  const addMember = (name: string, member: MemberPending) => {
    for (const t of member.team_tasks) {
      items.push({
        key: `team-${t.id}`,
        title: t.message_text,
        assignee: name,
        startedAt: t.pipeline_started_at,
        isBlocking: false,
        teamTaskId: t.id,
      })
    }
    for (const g of member.watch_groups) {
      for (const t of g.tasks) {
        items.push({
          key: `watch-${t.id}`,
          title: t.label,
          subtitle: g.stock_no ? `#${g.stock_no} · ${g.watch_label}` : g.watch_label,
          assignee: name,
          startedAt: t.pipeline_started_at,
          isBlocking: t.is_blocking,
          watchId: g.watch_id,
          phase: g.phase === 'SELL' ? 'SELL' : 'BUY',
        })
      }
    }
  }

  for (const m of members) {
    if (m.pending_count > 0) addMember(m.member.name, m)
  }
  if (unassigned.pending_count > 0) {
    addMember('Unassigned', {
      member: { id: 0, name: 'Unassigned', department: 'SALES' },
      pending_count: unassigned.pending_count,
      overdue_count: unassigned.overdue_count,
      due_soon_count: unassigned.due_soon_count,
      team_tasks: unassigned.team_tasks,
      watch_groups: unassigned.watch_groups,
    })
  }

  return items
}

function matchesFilter(item: QueueItem, filter: PendingFilter, now: Date): boolean {
  const urgency = taskUrgency(item.startedAt, now)
  if (filter === 'all') return true
  if (filter === 'overdue') return urgency === 'overdue'
  if (filter === 'due_soon') return urgency === 'warning'
  return true
}

interface PendingQueuePanelProps {
  members: MemberPending[]
  unassigned: UnassignedPending
  filter: PendingFilter
  now: Date
  onOpenWatch?: (watchId: number, phase: 'BUY' | 'SELL') => void
  onRefresh?: () => void
}

export default function PendingQueuePanel({
  members,
  unassigned,
  filter,
  now,
  onOpenWatch,
  onRefresh,
}: PendingQueuePanelProps) {
  const [toggling, setToggling] = useState<number | null>(null)

  const queue = useMemo(() => {
    const items = buildQueueItems(members, unassigned)
      .filter(item => matchesFilter(item, filter, now))
      .sort((a, b) => {
        const ua = getPipelineUrgency(new Date(a.startedAt), now)
        const ub = getPipelineUrgency(new Date(b.startedAt), now)
        if (URGENCY_ORDER[ua] !== URGENCY_ORDER[ub]) {
          return URGENCY_ORDER[ua] - URGENCY_ORDER[ub]
        }
        return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
      })
    return items
  }, [members, unassigned, filter, now])

  const completeTeamTask = async (taskId: number) => {
    setToggling(taskId)
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: true }),
      })
      onRefresh?.()
    } finally {
      setToggling(null)
    }
  }

  if (queue.length === 0) {
    return (
      <div className="py-8 text-center text-muted">
        <p className="font-semibold">No tasks match this filter</p>
      </div>
    )
  }

  return (
    <div className="task-strip-list">
      {queue.map((item, index) => {
        const urgency = getPipelineUrgency(new Date(item.startedAt), now)
        const elapsed = formatPipelineElapsed(new Date(item.startedAt), now)
        const isWatch = item.watchId != null

        return (
          <div
            key={item.key}
            className={`task-strip ${URGENCY_CLASS[urgency]}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (isWatch && item.watchId) {
                onOpenWatch?.(item.watchId, item.phase ?? 'BUY')
              } else if (item.teamTaskId) {
                completeTeamTask(item.teamTaskId)
              }
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                if (isWatch && item.watchId) onOpenWatch?.(item.watchId, item.phase ?? 'BUY')
                else if (item.teamTaskId) completeTeamTask(item.teamTaskId)
              }
            }}
          >
            <div
              className="task-strip-shimmer"
              style={{ animationDelay: `${index * 0.35}s` }}
              aria-hidden
            />
            <div className="task-strip-body">
              <span className="task-strip-icon" aria-hidden>⚠️</span>
              <div className="min-w-0 flex-1">
                <span className="task-strip-title">{item.title}</span>
                <p className="text-xs text-white/75 mt-0.5 truncate font-medium">
                  {item.assignee}
                  {item.subtitle ? ` · ${item.subtitle}` : ''}
                </p>
                {item.isBlocking && (
                  <span className="task-strip-blocking-chip">Blocking</span>
                )}
              </div>
            </div>
            <div className="task-strip-meta">
              <div className="task-strip-timer">
                <span className="task-strip-timer-label">{URGENCY_LABELS[urgency]}</span>
                <span className="task-strip-timer-value font-mono-data">{elapsed}</span>
              </div>
              <button
                type="button"
                className="task-strip-action"
                disabled={!isWatch && toggling === item.teamTaskId}
                onClick={e => {
                  e.stopPropagation()
                  if (isWatch && item.watchId) onOpenWatch?.(item.watchId, item.phase ?? 'BUY')
                  else if (item.teamTaskId) completeTeamTask(item.teamTaskId)
                }}
              >
                {isWatch ? 'Review' : 'Done'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
