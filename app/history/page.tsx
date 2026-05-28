'use client'

import { useState, useEffect, useCallback } from 'react'

type Department = 'ACCOUNTING' | 'SALES' | 'LOGISTICS'

interface WatchInfo {
  id: number
  name: string
  brand: string | null
  model: string | null
}

interface WatchTask {
  id: number
  watch_id: number
  department: Department
  task_type: string
  is_completed: boolean
  completed_at: string | null
  completed_by: string | null
  is_locked: boolean
  created_at: string
  watch: WatchInfo
}

const TASK_LABELS: Record<string, string> = {
  ACCOUNTING_MARK_PAYMENT: 'Mark Payment Status',
  SALES_SET_PRICE: 'Set Price',
  SALES_UPLOAD_DRIVE: 'Upload to Drive',
  SALES_UPLOAD_STOCK_GROUP: 'Upload Photos To Whatsapp Stock Photos',
  SALES_UPDATE_B2B: 'Research B2B Price',
  SALES_GET_B2C_PRICES: 'Get B2C Prices from Josh',
  LOGISTICS_SET_LOCATION: 'Set Location',
  LOGISTICS_UPDATE_COST: 'Update Logistics Cost',
  LOGISTICS_ACCESSORIES_BOX: 'Box',
  LOGISTICS_ACCESSORIES_PAPERS: 'Papers',
  LOGISTICS_ACCESSORIES_EXTRA_LINKS: 'Extra Links',
  LOGISTICS_ACCESSORIES_WARRANTY_CARD: 'Warranty Card',
  LOGISTICS_ACCESSORIES_HANG_TAG: 'Hang Tag',
}

const DEPT_BADGE: Record<Department, string> = {
  ACCOUNTING: 'bg-panel text-ink border-default',
  SALES: 'bg-accent/10 text-accent border-accent/30',
  LOGISTICS: 'bg-card text-muted border-default',
}

export default function HistoryPage() {
  const [tasks, setTasks] = useState<WatchTask[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    department: '',
    status: 'all',
    search: '',
    date_from: '',
    date_to: '',
  })

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/watch-tasks/history')
      if (res.ok) setTasks(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const filtered = tasks.filter(t => {
    if (filters.department && t.department !== filters.department) return false
    if (filters.status === 'completed' && !t.is_completed) return false
    if (filters.status === 'pending' && t.is_completed) return false
    if (filters.search) {
      const wName = [t.watch.brand, t.watch.model].filter(Boolean).join(' ') || t.watch.name
      const taskLabel = TASK_LABELS[t.task_type] ?? t.task_type
      const q = filters.search.toLowerCase()
      if (!wName.toLowerCase().includes(q) && !taskLabel.toLowerCase().includes(q)) return false
    }
    if (filters.date_from && t.completed_at && t.completed_at < filters.date_from) return false
    if (filters.date_to && t.completed_at && t.completed_at > filters.date_to + 'T23:59:59') return false
    return true
  })

  // Per-watch progress
  const watchProgress = new Map<number, { total: number; completed: number }>()
  for (const t of tasks) {
    if (!watchProgress.has(t.watch_id)) watchProgress.set(t.watch_id, { total: 0, completed: 0 })
    watchProgress.get(t.watch_id)!.total++
    if (t.is_completed) watchProgress.get(t.watch_id)!.completed++
  }

  const clearFilters = () => setFilters({ department: '', status: 'all', search: '', date_from: '', date_to: '' })
  const hasFilters = !!(filters.department || filters.status !== 'all' || filters.search || filters.date_from || filters.date_to)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-6 sm:px-8 border-b border-default bg-card">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink tracking-wide">Task History</h1>
        <p className="text-muted mt-1 text-sm">All watch tasks and completion status</p>
      </div>

      <div className="px-4 py-4 sm:px-8 bg-card border-b border-default flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="section-label block mb-2">Search</label>
          <input type="text" value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            placeholder="Watch name or task…"
            className="input-field" />
        </div>
        <div className="min-w-40">
          <label className="section-label block mb-2">Department</label>
          <select value={filters.department}
            onChange={e => setFilters(f => ({ ...f, department: e.target.value }))}
            className="input-field">
            <option value="">All departments</option>
            <option value="ACCOUNTING">Accounting</option>
            <option value="SALES">Sales</option>
            <option value="LOGISTICS">Logistics</option>
          </select>
        </div>
        <div className="min-w-36">
          <label className="section-label block mb-2">Status</label>
          <select value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="input-field">
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        <div>
          <label className="section-label block mb-2">Completed from</label>
          <input type="date" value={filters.date_from}
            onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))}
            className="input-field" />
        </div>
        <div>
          <label className="section-label block mb-2">To</label>
          <input type="date" value={filters.date_to}
            onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))}
            className="input-field" />
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="btn-ghost">Clear</button>
        )}
      </div>

      <div className="flex-1 overflow-auto px-4 py-6 sm:px-8">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted gap-2">
            <p className="text-lg font-semibold text-ink">No tasks found</p>
            {hasFilters && <button onClick={clearFilters} className="text-accent hover:underline text-sm">Clear filters</button>}
          </div>
        ) : (
          <>
          <div className="md:hidden flex flex-col gap-3">
            {filtered.map(task => {
              const wName = [task.watch.brand, task.watch.model].filter(Boolean).join(' ') || task.watch.name
              const taskLabel = TASK_LABELS[task.task_type] ?? task.task_type
              return (
                <div key={task.id} className="card p-4">
                  <p className="font-display font-semibold text-ink">{wName}</p>
                  <p className="text-sm text-muted mt-1">{taskLabel}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${DEPT_BADGE[task.department]}`}>{task.department}</span>
                    {task.is_completed ? (
                      <span className="text-xs font-semibold text-accent">Done</span>
                    ) : (
                      <span className="text-xs text-muted">Pending</span>
                    )}
                  </div>
                  {task.completed_at && (
                    <p className="text-xs text-muted mt-2">{new Date(task.completed_at).toLocaleString()}</p>
                  )}
                </div>
              )
            })}
          </div>
          <div className="hidden md:block overflow-x-auto card">
            <table className="w-full text-base">
              <thead>
                <tr className="bg-panel text-muted text-xs uppercase tracking-widest border-b border-default">
                  <th className="text-left px-6 py-4 font-semibold">Watch</th>
                  <th className="text-left px-6 py-4 font-semibold">Department</th>
                  <th className="text-left px-6 py-4 font-semibold">Task</th>
                  <th className="text-left px-6 py-4 font-semibold">Status</th>
                  <th className="text-left px-6 py-4 font-semibold whitespace-nowrap">Completed At</th>
                  <th className="text-left px-6 py-4 font-semibold">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {filtered.map(task => {
                  const wName = [task.watch.brand, task.watch.model].filter(Boolean).join(' ') || task.watch.name
                  const prog = watchProgress.get(task.watch_id)
                  const pct = prog ? Math.round((prog.completed / prog.total) * 100) : 0
                  return (
                    <tr key={task.id} className="bg-card hover:bg-panel/50 transition-colors">
                      <td className="px-6 py-4 text-ink font-medium">{wName}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${DEPT_BADGE[task.department]}`}>
                          {task.department}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted">{TASK_LABELS[task.task_type] ?? task.task_type}</td>
                      <td className="px-6 py-4">
                        {task.is_completed ? (
                          <span className="text-accent font-semibold text-sm">Done</span>
                        ) : task.is_locked ? (
                          <span className="text-muted text-sm">Locked</span>
                        ) : (
                          <span className="text-muted text-sm">Pending</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-muted whitespace-nowrap text-sm">
                        {task.completed_at ? new Date(task.completed_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4">
                        {prog && (
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-panel rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-accent' : 'bg-ink/30'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted font-medium">{pct}%</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="bg-panel px-6 py-3 text-muted text-sm text-right border-t border-default">
              {filtered.length} record{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
