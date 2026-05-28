'use client'

import { useState, useEffect, useCallback } from 'react'
import { getTaskLabel } from '@/lib/task-labels'

interface TeamMember { id: number; name: string; department: string }

interface WatchSellTask {
  id: number
  watch_id: number
  department: string
  task_type: string
  phase: string
  is_completed: boolean
  completed_at: string | null
  assigned_to: string | null
  watch: { id: number; name: string; brand: string | null; model: string | null }
}

const DEPT_CONFIG = {
  ACCOUNTING: { label: 'Accounting', icon: '💰', color: 'text-amber-700', border: 'border-amber-200', bg: 'bg-amber-50' },
  SALES:      { label: 'Sales',      icon: '🤝', color: 'text-emerald-700', border: 'border-emerald-200', bg: 'bg-emerald-50' },
  LOGISTICS:  { label: 'Logistics',  icon: '📦', color: 'text-blue-700', border: 'border-blue-200', bg: 'bg-blue-50' },
}
const DEPT_ORDER = ['ACCOUNTING', 'SALES', 'LOGISTICS']

export default function WatchSellTaskPanel({ className, focusedWatchId }: { className?: string; focusedWatchId?: number | null }) {
  const [tasks, setTasks] = useState<WatchSellTask[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedWatchId, setExpandedWatchId] = useState<number | null>(null)

  useEffect(() => {
    if (focusedWatchId != null) {
      setExpandedWatchId(focusedWatchId)
      requestAnimationFrame(() => {
        document.getElementById(`watch-sell-tasks-${focusedWatchId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [focusedWatchId])

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/watch-tasks?phase=SELL')
      if (res.ok) {
        const data = await res.json()
        setTasks(data)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/team-members')
      if (res.ok) setTeamMembers(await res.json())
    } catch (err) { console.error(err) }
  }, [])

  useEffect(() => { fetchTasks(); fetchMembers() }, [fetchTasks, fetchMembers])

  // SSE
  useEffect(() => {
    let es: EventSource | null = null
    const connect = () => {
      es = new EventSource('/api/sse')
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (['task_completed', 'task_updated', 'watch_sold', 'watch_updated'].includes(data.type)) fetchTasks()
        } catch { /* ignore */ }
      }
      es.onerror = () => { es?.close(); setTimeout(connect, 5000) }
    }
    connect()
    return () => es?.close()
  }, [fetchTasks])

  const toggleTask = useCallback(async (task: WatchSellTask) => {
    const res = await fetch(`/api/watch-tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: !task.is_completed }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...updated } : t))
    }
  }, [])

  const assignTask = useCallback(async (taskId: number, name: string | null) => {
    const res = await fetch(`/api/watch-tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: name }),
    })
    if (res.ok) setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assigned_to: name } : t))
  }, [])

  // Group by watch
  const byWatch = new Map<number, { watchId: number; watchName: string; tasks: WatchSellTask[] }>()
  for (const task of tasks) {
    if (!byWatch.has(task.watch_id)) {
      const wName = [task.watch.brand, task.watch.model].filter(Boolean).join(' ') || task.watch.name
      byWatch.set(task.watch_id, { watchId: task.watch_id, watchName: wName, tasks: [] })
    }
    byWatch.get(task.watch_id)!.tasks.push(task)
  }

  const watchGroups = Array.from(byWatch.values()).sort((a, b) => b.watchId - a.watchId)
  const totalPending = tasks.filter(t => !t.is_completed).length

  if (loading) return <div className={`flex items-center justify-center h-40 text-slate-400 ${className}`}>Loading sell tasks…</div>

  if (tasks.length === 0) return (
    <div className={`flex flex-col items-center justify-center h-40 text-slate-400 gap-2 ${className}`}>
      <span className="text-4xl">🏷️</span>
      <p className="font-semibold text-lg">No sell tasks yet</p>
      <p className="text-sm text-center px-4">Import a sell watch — tasks appear automatically</p>
    </div>
  )

  return (
    <div className={className}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 px-4 py-2.5 bg-white rounded-xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 text-sm font-medium">
              {totalPending === 0
                ? '🎉 All sell tasks complete!'
                : `${totalPending} pending · ${watchGroups.length} sell watch${watchGroups.length !== 1 ? 'es' : ''}`}
            </span>
          </div>
        </div>

        {watchGroups.map(({ watchId, watchName, tasks: watchTasks }) => {
          const pending = watchTasks.filter(t => !t.is_completed).length
          const allDone = pending === 0
          const expanded = expandedWatchId === watchId

          const deptTasks: Record<string, WatchSellTask[]> = { ACCOUNTING: [], SALES: [], LOGISTICS: [] }
          for (const t of watchTasks) {
            if (deptTasks[t.department]) deptTasks[t.department].push(t)
          }

          return (
            <div id={`watch-sell-tasks-${watchId}`} key={watchId} className={`rounded-2xl border overflow-hidden mb-3 shadow-sm scroll-mt-4 ${allDone ? 'border-emerald-200' : 'border-orange-200'}`}>
              {/* Watch header */}
              <div
                className={`flex items-center gap-2 px-4 py-3.5 cursor-pointer ${allDone ? 'bg-emerald-50' : 'bg-orange-50'}`}
                onClick={() => setExpandedWatchId(prev => prev === watchId ? null : watchId)}
              >
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${allDone ? 'bg-emerald-500' : 'bg-orange-500'}`} />
                <span className={`font-black text-base flex-1 truncate ${allDone ? 'text-emerald-800' : 'text-orange-900'}`}>{watchName}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 flex-shrink-0">🏷️ SELL</span>
                {allDone
                  ? <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex-shrink-0">✓ Done</span>
                  : <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200 flex-shrink-0">{pending} left</span>
                }
                <span className={`text-slate-400 text-sm transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>▾</span>
              </div>

              {expanded && (
                <div className="border-t border-slate-100">
                  {DEPT_ORDER.map((dept) => {
                    const dt = deptTasks[dept]
                    if (!dt || dt.length === 0) return null
                    const cfg = DEPT_CONFIG[dept as keyof typeof DEPT_CONFIG]
                    const deptPending = dt.filter(t => !t.is_completed).length
                    return (
                      <div key={dept} className="px-3 py-3 border-b border-slate-100 last:border-b-0">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl mb-2.5 ${cfg.bg} border ${cfg.border}`}>
                          <span className="text-sm">{cfg.icon}</span>
                          <span className={`text-xs font-black uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
                          <span className={`ml-auto text-[10px] font-bold ${deptPending === 0 ? 'text-emerald-600' : cfg.color}`}>
                            {deptPending === 0 ? '✓ Done' : `${deptPending} left`}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          {dt.map(task => (
                            <SellTaskRow
                              key={task.id}
                              task={task}
                              teamMembers={teamMembers}
                              onToggle={toggleTask}
                              onAssign={(name) => assignTask(task.id, name)}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SellTaskRow({
  task, teamMembers, onToggle, onAssign
}: {
  task: WatchSellTask
  teamMembers: TeamMember[]
  onToggle: (task: WatchSellTask) => Promise<void>
  onAssign: (name: string | null) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)

  const handleToggle = async () => {
    setSaving(true)
    try { await onToggle(task) } finally { setSaving(false) }
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${task.is_completed ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
      <div
        onClick={handleToggle}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${task.is_completed ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 hover:border-indigo-400 bg-white'}`}
      >
        {task.is_completed && !saving && <span className="text-white text-[10px] font-black leading-none">✓</span>}
        {saving && <span className="text-slate-400 text-[10px] animate-spin inline-block">⟳</span>}
      </div>
      <span className={`text-sm flex-1 leading-snug ${task.is_completed ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>
        {getTaskLabel(task.task_type, 'SELL')}
      </span>

      {/* Simple assignee button */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setAssignOpen(o => !o)}
          className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
            task.assigned_to
              ? 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'
              : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-indigo-300 hover:text-indigo-500'
          }`}
        >
          {task.assigned_to ? <>👤 {task.assigned_to}</> : <>+ Assign</>}
        </button>
        {assignOpen && (
          <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl border border-slate-200 shadow-lg min-w-[120px] py-1 overflow-hidden">
            {teamMembers.map(m => (
              <button key={m.id} onClick={async () => { setAssignOpen(false); await onAssign(m.name) }}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${task.assigned_to === m.name ? 'bg-violet-50 text-violet-700 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}>
                👤 {m.name}
              </button>
            ))}
            {task.assigned_to && (
              <>
                <div className="border-t border-slate-100 my-1" />
                <button onClick={async () => { setAssignOpen(false); await onAssign(null) }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-50 hover:text-red-500">Remove</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
