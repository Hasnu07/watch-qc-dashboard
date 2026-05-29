'use client'

import { useState, useEffect, useCallback } from 'react'
import { DEPT_CONFIG, type Department } from '@/lib/ui-constants'
import { formatPipelineElapsed, getPipelineUrgency, isOverPipelineSla, type PipelineUrgency } from '@/lib/pipeline-timer'

const URGENCY_LABELS: Record<PipelineUrgency, string> = {
  fresh: 'Waiting',
  warning: 'Due soon',
  overdue: 'Overdue',
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

function PipelineTimer({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])

  const start = new Date(startedAt)
  const urgency = getPipelineUrgency(start, now)
  const elapsed = formatPipelineElapsed(start, now)

  return (
    <span
      className={`pipeline-timer pipeline-timer-${urgency}`}
      title={`In pipeline for ${elapsed}${isOverPipelineSla(start, now) ? ' — past 24h SLA' : ''}`}
    >
      <span className="pipeline-timer-label">{URGENCY_LABELS[urgency]}</span>
      <span className="pipeline-timer-value font-mono-data">{elapsed}</span>
    </span>
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
    <div className="p-4 sm:p-5 space-y-3">
      <p className="text-xs text-muted mb-1">
        {totalPending} pending across {data.filter(m => m.pending_count > 0).length} people
      </p>

      {data.map(({ member, pending_count, team_tasks, watch_groups }) => {
        const isOpen = expanded.has(member.id)
        const overdueCount = countOverdueTasks(team_tasks, watch_groups, now)
        return (
          <section key={member.id} className="rounded-xl border border-default bg-card overflow-hidden">
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
                <span className="pipeline-timer pipeline-timer-overdue !min-w-0 !px-2.5 !py-1.5">
                  <span className="pipeline-timer-label !text-[0.5rem]">{overdueCount} overdue</span>
                </span>
              )}
              <span className={`text-sm font-bold tabular-nums ${pending_count > 0 ? 'text-accent' : 'text-muted'}`}>
                {pending_count} Remain
              </span>
              <span className="text-muted text-xs">{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <div className="border-t border-default px-4 py-3 space-y-4 bg-panel/30">
                {pending_count === 0 ? (
                  <p className="text-sm text-muted py-1">No pending tasks</p>
                ) : (
                  <>
                    {team_tasks.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">Team tasks</h4>
                        <ul className="space-y-2">
                          {team_tasks.map(t => {
                            const overdue = isOverPipelineSla(new Date(t.pipeline_started_at), now)
                            return (
                            <li
                              key={t.id}
                              className={`pending-task-row ${overdue ? 'pending-task-row-overdue' : ''}`}
                            >
                              <PipelineTimer startedAt={t.pipeline_started_at} />
                              <button
                                type="button"
                                disabled={toggling === t.id}
                                onClick={() => completeTeamTask(t.id)}
                                className="w-5 h-5 rounded border-2 border-default flex-shrink-0 hover:border-accent disabled:opacity-50"
                                aria-label="Mark complete"
                              />
                              <span className="text-ink leading-snug flex-1 min-w-0 font-medium">{t.message_text}</span>
                            </li>
                          )})}
                        </ul>
                      </div>
                    )}

                    {watch_groups.length > 0 && (
                      <div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">Watch tasks</h4>
                        <div className="space-y-3">
                          {watch_groups.map(group => (
                            <div key={group.watch_id} className="rounded-lg border border-default/80 bg-card/80 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => onOpenWatch?.(group.watch_id, group.phase === 'SELL' ? 'SELL' : 'BUY')}
                                className={`w-full text-left px-3 py-2 text-sm font-semibold border-b border-default/60 hover:bg-panel/50 ${
                                  group.phase === 'SELL' ? 'text-[var(--color-sell)]' : 'text-[var(--color-buy)]'
                                }`}
                              >
                                {group.watch_label}
                                <span className="ml-2 text-[10px] font-bold uppercase opacity-70">{group.phase}</span>
                              </button>
                              <ul className="px-2 py-2 space-y-2">
                                {group.tasks.map(t => {
                                  const overdue = isOverPipelineSla(new Date(t.pipeline_started_at), now)
                                  return (
                                  <li
                                    key={t.id}
                                    className={`pending-task-row ${overdue ? 'pending-task-row-overdue' : ''}`}
                                  >
                                    <PipelineTimer startedAt={t.pipeline_started_at} />
                                    <span className="flex-1 min-w-0 font-medium text-ink">{t.label}</span>
                                  </li>
                                )})}
                              </ul>
                            </div>
                          ))}
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
