'use client'

import { useState, useEffect, useCallback } from 'react'
import { DEPT_CONFIG, type Department } from '@/lib/ui-constants'
import { formatPipelineElapsed, getPipelineUrgency, isOverPipelineSla, type PipelineUrgency } from '@/lib/pipeline-timer'

const URGENCY_LABELS: Record<PipelineUrgency, string> = {
  fresh: 'Waiting',
  warning: 'Due soon',
  overdue: 'Overdue',
}

const URGENCY_ICONS: Record<PipelineUrgency, string> = {
  fresh: '⏳',
  warning: '⚠️',
  overdue: '⚠️',
}

interface MemberPending {
  member: { id: number; name: string; department: Department }
  pending_count: number
  team_tasks: Array<{ id: number; message_text: string; date: string; created_at: string; pipeline_started_at: string }>
  watch_groups: Array<{
    watch_id: number
    watch_label: string
    phase: string
    tasks: Array<{ id: number; task_type: string; label: string; department: string; phase: string; pipeline_started_at: string }>
  }>
}

interface PendingTasksPanelProps {
  onOpenWatch?: (watchId: number, phase: 'BUY' | 'SELL') => void
}

interface TaskStripProps {
  title: string
  startedAt: string
  now: Date
  shimmerDelay?: number
  actionLabel?: string
  actionDisabled?: boolean
  onAction?: () => void
  onStripClick?: () => void
}

function TaskStrip({
  title,
  startedAt,
  now,
  shimmerDelay = 0,
  actionLabel = 'Review',
  actionDisabled = false,
  onAction,
  onStripClick,
}: TaskStripProps) {
  const start = new Date(startedAt)
  const urgency = getPipelineUrgency(start, now)
  const elapsed = formatPipelineElapsed(start, now)
  const showShimmer = urgency !== 'fresh'

  return (
    <div
      className={`task-strip task-strip-${urgency}`}
      onClick={onStripClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onStripClick?.() }}
    >
      {showShimmer && (
        <div className="task-strip-shimmer" style={{ animationDelay: `${shimmerDelay}s` }} />
      )}
      <div className="task-strip-body">
        <span className="task-strip-icon" aria-hidden>{URGENCY_ICONS[urgency]}</span>
        <span className="task-strip-title">{title}</span>
      </div>
      <div className="task-strip-meta">
        <div
          className="task-strip-timer"
          style={urgency === 'overdue' || urgency === 'warning' ? { animationDelay: `${shimmerDelay}s` } : undefined}
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

function countOverdueTasks(
  teamTasks: MemberPending['team_tasks'],
  watchGroups: MemberPending['watch_groups'],
  now: Date,
): number {
  let count = 0
  for (const t of teamTasks) {
    if (isOverPipelineSla(new Date(t.pipeline_started_at), now)) count++
  }
  for (const g of watchGroups) {
    for (const t of g.tasks) {
      if (isOverPipelineSla(new Date(t.pipeline_started_at), now)) count++
    }
  }
  return count
}

function MemberAvatar({ name, department }: { name: string; department: Department }) {
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${DEPT_CONFIG[department].solid}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function PendingTasksPanel({ onOpenWatch }: PendingTasksPanelProps) {
  const [data, setData] = useState<MemberPending[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [toggling, setToggling] = useState<number | null>(null)
  const [now, setNow] = useState(() => new Date())

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/pending-tasks-by-member')
      if (!res.ok) throw new Error('fetch failed')
      const json: MemberPending[] = await res.json()
      setData(json)
      setExpanded(prev => {
        if (prev.size > 0) return prev
        const withTasks = json.filter(m => m.pending_count > 0).map(m => m.member.id)
        return new Set(withTasks.length > 0 ? withTasks : json.slice(0, 3).map(m => m.member.id))
      })
    } catch {
      setData([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let es: EventSource | null = null
    try {
      es = new EventSource('/api/sse')
      es.onmessage = () => fetchData()
    } catch { /* ignore */ }
    return () => es?.close()
  }, [fetchData])

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
      await fetchData()
    } finally {
      setToggling(null)
    }
  }

  const totalPending = data.reduce((sum, m) => sum + m.pending_count, 0)

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl bg-panel animate-pulse" />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="p-6 text-center text-muted">
        <p className="font-semibold">No team members found</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-5 space-y-3 max-w-3xl mx-auto w-full">
      <p className="text-xs text-muted mb-1">
        {totalPending} pending across {data.filter(m => m.pending_count > 0).length} people
      </p>

      {data.map(({ member, pending_count, team_tasks, watch_groups }) => {
        const isOpen = expanded.has(member.id)
        const overdueCount = countOverdueTasks(team_tasks, watch_groups, now)
        let stripIndex = 0

        return (
          <section key={member.id} className="rounded-xl border border-white/10 bg-card overflow-hidden shadow-lg">
            <button
              type="button"
              onClick={() => toggleExpanded(member.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-panel/60 transition-colors"
            >
              <MemberAvatar name={member.name} department={member.department} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink truncate">{member.name}</p>
                <p className="text-xs text-muted capitalize">{member.department.toLowerCase()}</p>
              </div>
              {overdueCount > 0 && (
                <span className="member-overdue-pill">{overdueCount} overdue</span>
              )}
              <span className={`text-sm font-bold tabular-nums ${pending_count > 0 ? 'text-accent' : 'text-muted'}`}>
                {pending_count} Remain
              </span>
              <span className="text-muted text-xs">{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <div className="pending-member-body border-t border-white/10">
                {pending_count === 0 ? (
                  <p className="text-sm text-white/70 py-1">No pending tasks</p>
                ) : (
                  <>
                    {team_tasks.length > 0 && (
                      <div className="mb-4">
                        <h4 className="pending-section-title">Team tasks</h4>
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
                                onAction={() => completeTeamTask(t.id)}
                                onStripClick={() => completeTeamTask(t.id)}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {watch_groups.length > 0 && (
                      <div>
                        <h4 className="pending-section-title">Watch tasks</h4>
                        <div className="space-y-4">
                          {watch_groups.map(group => {
                            const phase = group.phase === 'SELL' ? 'SELL' : 'BUY'
                            const phaseClass = phase === 'SELL' ? 'text-sell' : 'text-buy'
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
                                        startedAt={t.pipeline_started_at}
                                        now={now}
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
      })}
    </div>
  )
}
