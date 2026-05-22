'use client'

import { useState, useEffect, useCallback } from 'react'

type Department = 'ACCOUNTING' | 'SALES' | 'LOGISTICS'
type PaymentStatus = 'NOT_PAID' | 'PARTIAL' | 'PAID'

interface WatchInfo {
  id: number
  name: string
  brand: string | null
  model: string | null
  ref_no: string | null
  payment_status: PaymentStatus
  website_price: string | number
  b2b_price: string | number
  logistics_cost: number | null
  logistics_cost_currency: string | null
}

interface WatchTask {
  id: number
  watch_id: number
  department: Department
  task_type: string
  is_completed: boolean
  completed_at: string | null
  is_locked: boolean
  metadata: Record<string, unknown> | null
  watch: WatchInfo
}

const DEPT_CONFIG = {
  ACCOUNTING: {
    label: 'Accounting', icon: '💰',
    color: 'text-amber-700', border: 'border-amber-200', bg: 'bg-amber-50', solid: 'bg-amber-500',
  },
  SALES: {
    label: 'Sales', icon: '🤝',
    color: 'text-emerald-700', border: 'border-emerald-200', bg: 'bg-emerald-50', solid: 'bg-emerald-500',
  },
  LOGISTICS: {
    label: 'Logistics', icon: '📦',
    color: 'text-blue-700', border: 'border-blue-200', bg: 'bg-blue-50', solid: 'bg-blue-500',
  },
}

const DEPT_ORDER: Department[] = ['ACCOUNTING', 'SALES', 'LOGISTICS']

const TASK_LABELS: Record<string, string> = {
  ACCOUNTING_MARK_PAYMENT: 'Mark Payment Status',
  SALES_SET_PRICE: 'Set Price',
  SALES_UPLOAD_DRIVE: 'Upload to Drive',
  SALES_UPLOAD_STOCK_GROUP: 'Upload to Stock Group',
  SALES_UPDATE_B2B: 'Update B2B Prices',
  LOGISTICS_SET_LOCATION: 'Set Location',
  LOGISTICS_UPDATE_COST: 'Update Logistics Cost',
  LOGISTICS_ACCESSORIES_BOX: 'Box',
  LOGISTICS_ACCESSORIES_PAPERS: 'Papers',
  LOGISTICS_ACCESSORIES_EXTRA_LINKS: 'Extra Links',
  LOGISTICS_ACCESSORIES_WARRANTY_CARD: 'Warranty Card',
  LOGISTICS_ACCESSORIES_HANG_TAG: 'Hang Tag',
}

const CURRENCIES = ['USD', 'GBP', 'EUR', 'HKD', 'AED']

const PAY_COLORS: Record<PaymentStatus, string> = {
  NOT_PAID: 'bg-red-50 text-red-700 border-red-200',
  PARTIAL: 'bg-amber-50 text-amber-700 border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}

const PAY_LABELS: Record<PaymentStatus, string> = {
  NOT_PAID: 'Not Paid', PARTIAL: 'Partial', PAID: 'Paid',
}

// Simple checkbox tasks that need no inline form
const SIMPLE_TASKS = [
  'SALES_UPLOAD_DRIVE', 'SALES_UPLOAD_STOCK_GROUP', 'SALES_UPDATE_B2B',
  'LOGISTICS_ACCESSORIES_BOX', 'LOGISTICS_ACCESSORIES_PAPERS',
  'LOGISTICS_ACCESSORIES_EXTRA_LINKS', 'LOGISTICS_ACCESSORIES_WARRANTY_CARD',
  'LOGISTICS_ACCESSORIES_HANG_TAG',
]

interface TaskRowProps {
  task: WatchTask
  onComplete: (taskId: number, metadata?: Record<string, unknown>) => Promise<void>
  onUncomplete: (taskId: number) => Promise<void>
}

function TaskRow({ task, onComplete, onUncomplete }: TaskRowProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [payStatus, setPayStatus] = useState<PaymentStatus>(task.watch.payment_status)
  const [websitePrice, setWebsitePrice] = useState(String(task.watch.website_price || ''))
  const [b2bPrice, setB2bPrice] = useState(String(task.watch.b2b_price || ''))
  const [cost, setCost] = useState(String(task.watch.logistics_cost || ''))
  const [costCurrency, setCostCurrency] = useState(task.watch.logistics_cost_currency || 'USD')

  // Sync external changes
  useEffect(() => { setPayStatus(task.watch.payment_status) }, [task.watch.payment_status])
  useEffect(() => { setWebsitePrice(String(task.watch.website_price || '')) }, [task.watch.website_price])
  useEffect(() => { setB2bPrice(String(task.watch.b2b_price || '')) }, [task.watch.b2b_price])
  useEffect(() => { setCost(String(task.watch.logistics_cost || '')) }, [task.watch.logistics_cost])

  // Locked task
  if (task.is_locked) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50/70 border border-slate-100">
        <span className="text-slate-300 text-sm flex-shrink-0">🔒</span>
        <span className="text-slate-400 text-sm">{TASK_LABELS[task.task_type] ?? task.task_type}</span>
        <span className="ml-auto text-xs text-slate-300 italic whitespace-nowrap">Awaiting payment</span>
      </div>
    )
  }

  const hasInlineForm = ['ACCOUNTING_MARK_PAYMENT', 'SALES_SET_PRICE', 'LOGISTICS_UPDATE_COST'].includes(task.task_type)

  const handleClick = async () => {
    if (saving) return
    if (task.is_completed) {
      setSaving(true)
      try { await onUncomplete(task.id) } finally { setSaving(false) }
      return
    }
    if (SIMPLE_TASKS.includes(task.task_type)) {
      setSaving(true)
      try { await onComplete(task.id) } finally { setSaving(false) }
      return
    }
    setOpen(o => !o)
  }

  const handleSavePayment = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setSaving(true)
    try { await onComplete(task.id, { payment_status: payStatus }); setOpen(false) }
    finally { setSaving(false) }
  }

  const handleSavePrice = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!websitePrice || !b2bPrice) return
    setSaving(true)
    try { await onComplete(task.id, { website_price: websitePrice, b2b_price: b2bPrice }); setOpen(false) }
    finally { setSaving(false) }
  }

  const handleSaveCost = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!cost) return
    setSaving(true)
    try { await onComplete(task.id, { logistics_cost: cost, logistics_cost_currency: costCurrency }); setOpen(false) }
    finally { setSaving(false) }
  }

  return (
    <div className={`rounded-xl border transition-all ${task.is_completed ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer select-none"
        onClick={handleClick}
      >
        {/* Checkbox */}
        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          task.is_completed
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-slate-300 hover:border-indigo-400 bg-white'
        }`}>
          {task.is_completed && <span className="text-white text-[10px] font-black leading-none">✓</span>}
          {saving && !task.is_completed && <span className="text-slate-400 text-[10px] animate-spin inline-block">⟳</span>}
        </div>

        <span className={`text-sm flex-1 leading-snug ${
          task.is_completed ? 'line-through text-slate-400' : 'text-slate-700 font-medium'
        }`}>
          {TASK_LABELS[task.task_type] ?? task.task_type}
        </span>

        {/* Payment status badge */}
        {task.task_type === 'ACCOUNTING_MARK_PAYMENT' && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PAY_COLORS[task.watch.payment_status]}`}>
            {PAY_LABELS[task.watch.payment_status]}
          </span>
        )}

        {/* Expand arrow */}
        {hasInlineForm && !task.is_completed && (
          <span className={`text-slate-400 text-xs transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>▾</span>
        )}
      </div>

      {/* Inline forms */}
      {open && !task.is_completed && (
        <div className="px-3 pb-3 border-t border-slate-100" onClick={e => e.stopPropagation()}>

          {task.task_type === 'ACCOUNTING_MARK_PAYMENT' && (
            <div className="pt-2.5 flex flex-col gap-2">
              <div className="flex gap-1.5">
                {(['NOT_PAID', 'PARTIAL', 'PAID'] as PaymentStatus[]).map(s => (
                  <button key={s} type="button"
                    onClick={() => setPayStatus(s)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      payStatus === s ? PAY_COLORS[s] : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'
                    }`}>
                    {PAY_LABELS[s]}
                  </button>
                ))}
              </div>
              <button onClick={handleSavePayment} disabled={saving}
                className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Save & Complete'}
              </button>
            </div>
          )}

          {task.task_type === 'SALES_SET_PRICE' && (
            <div className="pt-2.5 flex flex-col gap-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-1 block">Website $</label>
                  <input type="number" value={websitePrice} onChange={e => setWebsitePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-400" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-1 block">B2B $</label>
                  <input type="number" value={b2bPrice} onChange={e => setB2bPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-400" />
                </div>
              </div>
              <button onClick={handleSavePrice} disabled={saving || !websitePrice || !b2bPrice}
                className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Save & Complete'}
              </button>
            </div>
          )}

          {task.task_type === 'LOGISTICS_UPDATE_COST' && (
            <div className="pt-2.5 flex flex-col gap-2">
              <div className="flex gap-2">
                <input type="number" value={cost} onChange={e => setCost(e.target.value)}
                  placeholder="Cost amount"
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-400" />
                <select value={costCurrency} onChange={e => setCostCurrency(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-indigo-400">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={handleSaveCost} disabled={saving || !cost}
                className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Save & Complete'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface WatchTaskCardProps {
  watchId: number
  watchName: string
  tasks: WatchTask[]
  dept: Department
  onComplete: (taskId: number, metadata?: Record<string, unknown>) => Promise<void>
  onUncomplete: (taskId: number) => Promise<void>
}

function WatchTaskCard({ watchId: _watchId, watchName, tasks, dept, onComplete, onUncomplete }: WatchTaskCardProps) {
  const cfg = DEPT_CONFIG[dept]
  const allDone = tasks.every(t => t.is_completed || t.is_locked)
  const pendingCount = tasks.filter(t => !t.is_completed && !t.is_locked).length

  if (allDone) {
    return (
      <div className="bg-emerald-50 rounded-2xl border border-emerald-200 px-4 py-3 flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-black text-sm flex-shrink-0">✓</div>
        <div>
          <p className="text-emerald-800 font-bold text-sm leading-tight">{watchName}</p>
          <p className="text-emerald-600 text-xs mt-0.5">All {cfg.label} tasks complete</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-3 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.solid}`} />
        <h4 className="text-slate-900 font-bold text-sm flex-1 truncate">{watchName}</h4>
        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">
          {pendingCount} left
        </span>
      </div>
      <div className="px-3 py-2.5 flex flex-col gap-1.5">
        {tasks.map(task => (
          <TaskRow
            key={task.id}
            task={task}
            onComplete={onComplete}
            onUncomplete={onUncomplete}
          />
        ))}
      </div>
    </div>
  )
}

interface Props {
  className?: string
}

export default function WatchTaskPanel({ className }: Props) {
  const [tasks, setTasks] = useState<WatchTask[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/watch-tasks')
      if (res.ok) setTasks(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // SSE updates
  useEffect(() => {
    let es: EventSource | null = null
    const connect = () => {
      es = new EventSource('/api/sse')
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (['task_completed', 'task_unlocked', 'task_updated',
               'new_watch', 'watch_updated', 'watch_sold'].includes(data.type)) {
            fetchTasks()
          }
        } catch { /* ignore pings */ }
      }
      es.onerror = () => { es?.close(); setTimeout(connect, 5000) }
    }
    connect()
    return () => es?.close()
  }, [fetchTasks])

  const completeTask = useCallback(async (taskId: number, metadata?: Record<string, unknown>) => {
    const res = await fetch(`/api/watch-tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: true, ...(metadata ? { metadata } : {}) }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t
        // Merge watch updates from metadata
        const watchUpdates: Partial<WatchInfo> = {}
        if (metadata?.payment_status) watchUpdates.payment_status = metadata.payment_status as PaymentStatus
        if (metadata?.website_price) watchUpdates.website_price = metadata.website_price as number
        if (metadata?.b2b_price) watchUpdates.b2b_price = metadata.b2b_price as number
        if (metadata?.logistics_cost !== undefined) watchUpdates.logistics_cost = parseFloat(String(metadata.logistics_cost))
        if (metadata?.logistics_cost_currency) watchUpdates.logistics_cost_currency = metadata.logistics_cost_currency as string
        return { ...t, ...updated, watch: { ...t.watch, ...watchUpdates } }
      }))
      // If location task was unlocked, refresh to get updated locked state
      if (updated.task_type === 'ACCOUNTING_MARK_PAYMENT') fetchTasks()
    }
  }, [fetchTasks])

  const uncompleteTask = useCallback(async (taskId: number) => {
    const res = await fetch(`/api/watch-tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: false }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updated } : t))
    }
  }, [])

  // Group tasks: dept → watch_id → { watchName, tasks[] }
  const grouped = DEPT_ORDER.reduce((acc, dept) => {
    const deptTasks = tasks.filter(t => t.department === dept)
    const byWatch = new Map<number, { watchName: string; tasks: WatchTask[] }>()
    for (const task of deptTasks) {
      if (!byWatch.has(task.watch_id)) {
        const wName = [task.watch.brand, task.watch.model].filter(Boolean).join(' ') || task.watch.name
        byWatch.set(task.watch_id, { watchName: wName, tasks: [] })
      }
      byWatch.get(task.watch_id)!.tasks.push(task)
    }
    acc[dept] = byWatch
    return acc
  }, {} as Record<Department, Map<number, { watchName: string; tasks: WatchTask[] }>>)

  const totalPending = tasks.filter(t => !t.is_completed && !t.is_locked).length
  const watchesWithPending = new Set(tasks.filter(t => !t.is_completed && !t.is_locked).map(t => t.watch_id)).size

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-40 text-slate-400 text-base ${className}`}>
        Loading tasks…
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center h-40 text-slate-400 gap-2 ${className}`}>
        <span className="text-4xl">✓</span>
        <p className="font-semibold text-lg">No active watches</p>
        <p className="text-sm">Add a watch to generate tasks</p>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="p-4">
        {/* Summary pill */}
        <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <span className="text-slate-500 text-sm font-medium">
            {totalPending === 0
              ? '🎉 All tasks complete!'
              : `${totalPending} task${totalPending !== 1 ? 's' : ''} pending · ${watchesWithPending} watch${watchesWithPending !== 1 ? 'es' : ''}`
            }
          </span>
        </div>

        {DEPT_ORDER.map(dept => {
          const cfg = DEPT_CONFIG[dept]
          const watchMap = grouped[dept]
          if (!watchMap || watchMap.size === 0) return null

          const pendingInDept = Array.from(watchMap.values())
            .flatMap(w => w.tasks)
            .filter(t => !t.is_completed && !t.is_locked).length

          return (
            <div key={dept} className="mb-6">
              <div className={`flex items-center gap-2 mb-3 px-4 py-2.5 rounded-xl border-2 ${cfg.bg} ${cfg.border} shadow-sm`}>
                <span className="text-lg">{cfg.icon}</span>
                <span className={`font-black text-sm uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
                <span className={`ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                  {pendingInDept} pending
                </span>
              </div>

              {Array.from(watchMap.entries()).map(([watchId, { watchName, tasks: watchTasks }]) => (
                <WatchTaskCard
                  key={watchId}
                  watchId={watchId}
                  watchName={watchName}
                  tasks={watchTasks}
                  dept={dept}
                  onComplete={completeTask}
                  onUncomplete={uncompleteTask}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
