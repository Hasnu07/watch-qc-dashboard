'use client'

import { useState, useEffect, useRef } from 'react'
import { DEPT_CONFIG, type Department } from '@/lib/ui-constants'
import { formatPipelineElapsed, getPipelineUrgency, type PipelineUrgency } from '@/lib/pipeline-timer'
import type {
  MemberPending,
  PendingFilter,
  UnassignedPending,
} from '@/lib/pending-dashboard'
import { memberMatchesFilter, unassignedMatchesFilter } from '@/lib/pending-dashboard'

const UNASSIGNED_KEY = -1

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

interface PendingTasksPanelProps {
  members: MemberPending[]
  unassigned: UnassignedPending
  filter: PendingFilter
  onFilterChange?: (filter: PendingFilter) => void
  hideFilters?: boolean
  focusUnassigned?: boolean
  onFocusUnassignedHandled?: () => void
  loading?: boolean
  now: Date
  onOpenWatch?: (watchId: number, phase: 'BUY' | 'SELL') => void
  onRefresh?: () => void
}

interface TaskStripProps {
  title: string
  subtitle?: string | null
  startedAt: string
  now: Date
  isBlocking?: boolean
  shimmerDelay?: number
  actionLabel?: string
  actionDisabled?: boolean
  onAction?: () => void
  onStripClick?: () => void
}

function TaskStrip({
  title,
  subtitle,
  startedAt,
  now,
  isBlocking = false,
  shimmerDelay = 0,
  actionLabel = 'Review',
  actionDisabled = false,
  onAction,
  onStripClick,
}: TaskStripProps) {
  const start = new Date(startedAt)
  const urgency = getPipelineUrgency(start, now)
  const elapsed = formatPipelineElapsed(start, now)

  return (
    <div
      className={`task-strip ${URGENCY_CLASS[urgency]}`}
      onClick={onStripClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onStripClick?.() }}
    >
      <div
        className="task-strip-shimmer"
        style={{ animationDelay: `${shimmerDelay}s` }}
        aria-hidden
      />
      <div className="task-strip-body">
        <span className="task-strip-icon" aria-hidden>⚠️</span>
        <div className="min-w-0 flex-1">
          <span className="task-strip-title">{title}</span>
          {subtitle && (
            <p className="text-xs text-white/75 mt-0.5 truncate font-medium">{subtitle}</p>
          )}
          {isBlocking && (
            <span className="task-strip-blocking-chip">Blocking</span>
          )}
        </div>
      </div>
      <div className="task-strip-meta">
        <div
          className="task-strip-timer"
          style={{ animationDelay: `${shimmerDelay + 0.25}s` }}
        >
          <span className="task-strip-timer-label">{URGENCY_LABELS[urgency]}</span>
          <span className="task-strip-timer-value font-mono-data">{elapsed}</span>
        </div>
        <button
          type="button"
          className="task-strip-action"
          disabled={actionDisabled}
          onClick={e => {
            e.stopPropagation()
            onAction?.()
          }}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

function MemberAvatar({ name, department, unassigned }: { name: string; department: Department; unassigned?: boolean }) {
  if (unassigned) {
    return (
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 bg-zinc-600">
        ?
      </div>
    )
  }
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${DEPT_CONFIG[department].solid}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

const FILTER_OPTIONS: { id: PendingFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'due_soon', label: 'Due soon' },
]

function buildExpandedIds(
  filter: PendingFilter,
  members: MemberPending[],
  unassigned: UnassignedPending,
): Set<number> {
  const ids = new Set<number>()
  if (filter === 'overdue') {
    for (const m of members) {
      if (m.overdue_count > 0) ids.add(m.member.id)
    }
    if (unassigned.overdue_count > 0) ids.add(UNASSIGNED_KEY)
  } else if (filter === 'due_soon') {
    for (const m of members) {
      if (m.due_soon_count > 0) ids.add(m.member.id)
    }
    if (unassigned.due_soon_count > 0) ids.add(UNASSIGNED_KEY)
  } else {
    for (const m of members) {
      ids.add(m.member.id)
    }
    if (unassigned.pending_count > 0) ids.add(UNASSIGNED_KEY)
  }
  return ids
}

function MemberCard({
  memberKey,
  name,
  department,
  pending_count,
  overdue_count,
  team_tasks,
  watch_groups,
  isOpen,
  onToggle,
  now,
  toggling,
  onCompleteTeamTask,
  onOpenWatch,
  isUnassigned,
}: {
  memberKey: number
  name: string
  department: Department | string
  pending_count: number
  overdue_count: number
  team_tasks: MemberPending['team_tasks']
  watch_groups: MemberPending['watch_groups']
  isOpen: boolean
  onToggle: () => void
  now: Date
  toggling: number | null
  onCompleteTeamTask: (id: number) => void
  onOpenWatch?: (watchId: number, phase: 'BUY' | 'SELL') => void
  isUnassigned?: boolean
}) {
  let stripIndex = 0
  const dept = isUnassigned ? 'SALES' : ((department as Department) in DEPT_CONFIG ? (department as Department) : 'SALES')

  return (
    <section className="pending-member-card rounded-xl shadow-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={`member-strip w-full flex items-center gap-3 px-4 py-3.5 text-left ${
          isOpen ? 'member-strip-open' : 'member-strip-closed'
        } ${pending_count > 0 ? 'member-strip-red' : 'member-strip-empty'}`}
        style={
          pending_count > 0
            ? { background: 'linear-gradient(90deg, #dc2626 0%, #ef4444 100%)' }
            : undefined
        }
      >
        {pending_count > 0 && (
          <div className="task-strip-shimmer member-strip-shimmer" aria-hidden />
        )}
        <MemberAvatar name={name} department={dept} unassigned={isUnassigned} />
        <div className="flex-1 min-w-0 relative z-10">
          <p className={`font-bold truncate ${pending_count > 0 ? 'text-white text-glow' : 'text-ink'}`}>
            {name}
          </p>
          <p className={`text-xs capitalize ${pending_count > 0 ? 'text-white/75' : 'text-muted'}`}>
            {String(department).toLowerCase()}
          </p>
        </div>
        {pending_count > 0 && (
          <div className="relative z-10 flex items-center gap-2 flex-shrink-0">
            <div className="task-strip-timer">
              <span className="task-strip-timer-label">
                {overdue_count > 0
                  ? overdue_count === pending_count
                    ? 'Overdue'
                    : `${overdue_count} overdue`
                  : 'Pending'}
              </span>
              <span className="task-strip-timer-value font-mono-data">{pending_count}</span>
            </div>
          </div>
        )}
        {pending_count === 0 && (
          <span className="text-sm text-muted">Clear</span>
        )}
        <span className={`relative z-10 text-xs ${pending_count > 0 ? 'text-white/90' : 'text-muted'}`}>
          {isOpen ? '▾' : '▸'}
        </span>
      </button>

      {isOpen && (
        <div className="pending-member-body">
          {pending_count === 0 ? (
            <p className="text-sm text-white/70 py-1">No pending tasks</p>
          ) : (
            <>
              {team_tasks.length > 0 && (
                <div className="mb-4">
                  <h4 className="pending-section-title">Team Tasks</h4>
                  <div className="task-strip-list">
                    {team_tasks.map(t => {
                      const delay = stripIndex * 0.5
                      stripIndex++
                      return (
                        <TaskStrip
                          key={t.id}
                          title={t.message_text}
                          startedAt={t.pipeline_started_at}
                          now={now}
                          shimmerDelay={delay}
                          actionLabel="Done"
                          actionDisabled={toggling === t.id}
                          onAction={() => onCompleteTeamTask(t.id)}
                          onStripClick={() => onCompleteTeamTask(t.id)}
                        />
                      )
                    })}
                  </div>
                </div>
              )}

              {watch_groups.length > 0 && (
                <div>
                  <h4 className="pending-section-title">Watch Tasks</h4>
                  <div className="space-y-4">
                    {watch_groups.map(group => {
                      const phase = group.phase === 'SELL' ? 'SELL' : 'BUY'
                      const phaseClass = phase === 'SELL' ? 'text-sell' : 'text-buy'
                      const stockRef = group.stock_no ? `#${group.stock_no}` : null
                      return (
                        <div key={group.watch_id} className="pending-watch-group">
                          <div className="pending-watch-group-header">
                            <h4 className={`pending-watch-group-title ${phaseClass}`}>
                              {group.watch_label}
                            </h4>
                            <span className={`pending-watch-group-phase ${phaseClass}`}>{phase}</span>
                          </div>
                          <div className="task-strip-list">
                            {group.tasks.map(t => {
                              const delay = stripIndex * 0.5
                              stripIndex++
                              return (
                                <TaskStrip
                                  key={t.id}
                                  title={t.label}
                                  subtitle={stockRef}
                                  startedAt={t.pipeline_started_at}
                                  now={now}
                                  isBlocking={t.is_blocking}
                                  shimmerDelay={delay}
                                  actionLabel="Review"
                                  onAction={() => onOpenWatch?.(group.watch_id, phase)}
                                  onStripClick={() => onOpenWatch?.(group.watch_id, phase)}
                                />
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

export default function PendingTasksPanel({
  members,
  unassigned,
  filter,
  onFilterChange,
  hideFilters = false,
  focusUnassigned = false,
  onFocusUnassignedHandled,
  loading,
  now,
  onOpenWatch,
  onRefresh,
}: PendingTasksPanelProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [toggling, setToggling] = useState<number | null>(null)
  const prevFilter = useRef<PendingFilter>(filter)
  const wasLoading = useRef(true)

  const visibleMembers = members.filter(m => memberMatchesFilter(m, filter))
  const showUnassigned = unassignedMatchesFilter(unassigned, filter)

  useEffect(() => {
    if (loading) {
      wasLoading.current = true
      return
    }

    const justLoaded = wasLoading.current
    wasLoading.current = false
    const filterChanged = prevFilter.current !== filter

    if (justLoaded || filterChanged) {
      const sourceMembers = filter === 'all' ? members : visibleMembers
      setExpanded(buildExpandedIds(filter, sourceMembers, unassigned))
      prevFilter.current = filter
    }
  }, [filter, loading, members, unassigned, visibleMembers])

  useEffect(() => {
    if (!focusUnassigned || unassigned.pending_count === 0) return
    setExpanded(prev => {
      const next = new Set(prev)
      next.add(UNASSIGNED_KEY)
      return next
    })
    onFocusUnassignedHandled?.()
  }, [focusUnassigned, unassigned.pending_count, onFocusUnassignedHandled])

  const toggleExpanded = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

  if (loading) {
    return (
      <div className="pending-people-list p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl bg-panel animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className={hideFilters ? 'space-y-3 w-full' : 'pending-people-list p-4 sm:p-5 space-y-3 w-full'}>
      {!hideFilters && (
        <div className="pending-filter-chips flex flex-wrap gap-2 mb-2">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onFilterChange?.(opt.id)}
              className={`pending-filter-chip ${filter === opt.id ? 'pending-filter-chip-active' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {visibleMembers.length === 0 && !showUnassigned && (
        <div className="py-8 text-center text-muted">
          <p className="font-semibold">No tasks match this filter</p>
        </div>
      )}

      {visibleMembers.map(({ member, pending_count, overdue_count, team_tasks, watch_groups }) => (
        <MemberCard
          key={member.id}
          memberKey={member.id}
          name={member.name}
          department={member.department}
          pending_count={pending_count}
          overdue_count={overdue_count}
          team_tasks={team_tasks}
          watch_groups={watch_groups}
          isOpen={expanded.has(member.id)}
          onToggle={() => toggleExpanded(member.id)}
          now={now}
          toggling={toggling}
          onCompleteTeamTask={completeTeamTask}
          onOpenWatch={onOpenWatch}
        />
      ))}

      {showUnassigned && (
        <MemberCard
          memberKey={UNASSIGNED_KEY}
          name="Unassigned"
          department="—"
          pending_count={unassigned.pending_count}
          overdue_count={unassigned.overdue_count}
          team_tasks={unassigned.team_tasks}
          watch_groups={unassigned.watch_groups}
          isOpen={expanded.has(UNASSIGNED_KEY)}
          onToggle={() => toggleExpanded(UNASSIGNED_KEY)}
          now={now}
          toggling={toggling}
          onCompleteTeamTask={completeTeamTask}
          onOpenWatch={onOpenWatch}
          isUnassigned
        />
      )}
    </div>
  )
}
