'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import WatchTaskToolbar, { WatchTaskEmptyFilter } from '@/components/WatchTaskToolbar'
import { useWatchTaskFilters } from '@/hooks/useWatchTaskFilters'
import { useCurrentMember } from '@/hooks/useCurrentMember'
import { DEPT_CONFIG, DEPT_ORDER, type Department } from '@/lib/ui-constants'
type PaymentStatus = 'NOT_PAID' | 'PARTIAL' | 'PAID'
type LocationStatus = 'INCOMING' | 'IN_TRANSIT' | 'IN_STOCK'

interface TeamMember { id: number; name: string; department: string }

interface WatchInfo {
  id: number; name: string; brand: string | null; model: string | null; ref_no: string | null
  stock_no: string | null; fob_url: string | null
  payment_status: PaymentStatus; website_price: string | number; b2b_price: string | number
  logistics_cost: number | null; logistics_cost_currency: string | null
}

interface WatchTask {
  id: number; watch_id: number; department: Department; task_type: string
  is_completed: boolean; completed_at: string | null; is_locked: boolean
  assigned_to: string | null; metadata: Record<string, unknown> | null; watch: WatchInfo
}

const compactInput = 'input-field py-1.5 text-sm rounded-2xl'

const TASK_LABELS: Record<string, string> = {
  ACCOUNTING_MARK_PAYMENT: 'Mark Payment Status',
  ACCOUNTING_ADD_STOCK_FOB: 'Add Stock No in FOB',
  SALES_SET_PRICE: 'Set Price', SALES_UPLOAD_DRIVE: 'Upload to Drive',
  SALES_UPLOAD_STOCK_GROUP: 'Upload Photos To Whatsapp Stock Photos', SALES_UPDATE_B2B: 'Research B2B Price',
  SALES_GET_B2C_PRICES: 'Get B2C Prices from Josh',
  LOGISTICS_SET_LOCATION: 'Set Location', LOGISTICS_UPDATE_COST: 'Update Logistics Cost',
}

const ACCESSORY_TASK_TYPES = [
  'LOGISTICS_ACCESSORIES_BOX', 'LOGISTICS_ACCESSORIES_PAPERS', 'LOGISTICS_ACCESSORIES_EXTRA_LINKS',
  'LOGISTICS_ACCESSORIES_WARRANTY_CARD', 'LOGISTICS_ACCESSORIES_HANG_TAG',
]
const ACCESSORY_LABELS: Record<string, string> = {
  LOGISTICS_ACCESSORIES_BOX: 'Box', LOGISTICS_ACCESSORIES_PAPERS: 'Papers',
  LOGISTICS_ACCESSORIES_EXTRA_LINKS: 'Extra Links', LOGISTICS_ACCESSORIES_WARRANTY_CARD: 'Warranty Card',
  LOGISTICS_ACCESSORIES_HANG_TAG: 'Hang Tag',
}

const CURRENCIES = ['USD', 'GBP', 'EUR', 'HKD', 'AED']

const PAY_COLORS: Record<PaymentStatus, string> = {
  NOT_PAID: 'bg-red-50 text-red-700 border-red-200',
  PARTIAL: 'bg-amber-50 text-amber-700 border-amber-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
}
const PAY_LABELS: Record<PaymentStatus, string> = { NOT_PAID: 'Not Paid', PARTIAL: 'Partial', PAID: 'Paid' }

const LOC_COLORS: Record<LocationStatus, string> = {
  INCOMING: 'bg-panel text-ink border-default',
  IN_TRANSIT: 'bg-accent/10 text-accent border-accent/40',
  IN_STOCK: 'bg-emerald-50 text-emerald-700 border-emerald-300',
}
const LOC_LABELS: Record<LocationStatus, string> = {
  INCOMING: '📬 Incoming', IN_TRANSIT: '🚚 In Transit', IN_STOCK: '✅ In Stock',
}

const SIMPLE_TASKS = ['SALES_UPLOAD_DRIVE', 'SALES_UPLOAD_STOCK_GROUP', 'SALES_UPDATE_B2B', 'ACCOUNTING_ADD_STOCK_FOB']

// ── Assignee picker ────────────────────────────────────────────────────────

interface AssigneePickerProps {
  currentAssignee: string | null
  teamMembers: TeamMember[]
  onAssign: (name: string | null) => Promise<void>
}

function AssigneePicker({ currentAssignee, teamMembers, onAssign }: AssigneePickerProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = async (name: string | null) => {
    setOpen(false)
    setSaving(true)
    try { await onAssign(name) } finally { setSaving(false) }
  }

  return (
    <div ref={ref} className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all disabled:opacity-50 ${
          currentAssignee
            ? 'bg-accent/10 text-accent border-accent/30 hover:bg-accent/15'
            : 'bg-panel text-muted border-default hover:border-accent/40 hover:text-accent'
        }`}
      >
        {saving ? <span className="animate-spin inline-block">⟳</span>
          : currentAssignee ? <>👤 {currentAssignee}</>
          : <>+ Assign</>}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-card rounded-xl border border-default shadow-lg min-w-[120px] py-1 overflow-hidden">
          {teamMembers.map(m => (
            <button
              key={m.id}
              onClick={() => handleSelect(m.name)}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                currentAssignee === m.name
                  ? 'bg-accent/10 text-accent font-bold'
                  : 'text-ink hover:bg-panel'
              }`}
            >
              👤 {m.name}
            </button>
          ))}
          {currentAssignee && (
            <>
              <div className="border-t border-default my-1" />
              <button
                onClick={() => handleSelect(null)}
                className="w-full text-left px-3 py-1.5 text-xs text-muted hover:bg-panel hover:text-red-500 transition-colors"
              >
                Remove
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Task row ───────────────────────────────────────────────────────────────

interface TaskRowProps {
  task: WatchTask
  teamMembers: TeamMember[]
  canComplete: boolean
  canAssign: boolean
  onComplete: (taskId: number, metadata?: Record<string, unknown>) => Promise<void>
  onUncomplete: (taskId: number) => Promise<void>
  onAssign: (taskId: number, name: string | null) => Promise<void>
}

function TaskRow({ task, teamMembers, canComplete, canAssign, onComplete, onUncomplete, onAssign }: TaskRowProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [payStatus, setPayStatus] = useState<PaymentStatus>(task.watch.payment_status)
  const [websitePrice, setWebsitePrice] = useState(String(task.watch.website_price || ''))
  const [b2bPrice, setB2bPrice] = useState(String(task.watch.b2b_price || ''))
  const [cost, setCost] = useState(String(task.watch.logistics_cost || ''))
  const [costCurrency, setCostCurrency] = useState(task.watch.logistics_cost_currency || 'USD')
  const [locStatus, setLocStatus] = useState<LocationStatus>('IN_STOCK')
  const [locFrom, setLocFrom] = useState('')
  const [locTo, setLocTo] = useState('')

  useEffect(() => { setPayStatus(task.watch.payment_status) }, [task.watch.payment_status])
  useEffect(() => { setWebsitePrice(String(task.watch.website_price || '')) }, [task.watch.website_price])
  useEffect(() => { setB2bPrice(String(task.watch.b2b_price || '')) }, [task.watch.b2b_price])
  useEffect(() => { setCost(String(task.watch.logistics_cost || '')) }, [task.watch.logistics_cost])

  if (task.is_locked) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-panel border border-default">
        <span className="text-muted/50 text-sm">🔒</span>
        <span className="text-muted text-sm flex-1">{TASK_LABELS[task.task_type] ?? task.task_type}</span>
        <span className="text-xs text-muted/50 italic">Mark payment first</span>
      </div>
    )
  }

  const hasInlineForm = ['ACCOUNTING_MARK_PAYMENT', 'SALES_SET_PRICE', 'LOGISTICS_UPDATE_COST', 'LOGISTICS_SET_LOCATION'].includes(task.task_type)

  const handleClick = async () => {
    if (saving || !canComplete) return
    if (task.is_completed) { setSaving(true); try { await onUncomplete(task.id) } finally { setSaving(false) }; return }
    if (SIMPLE_TASKS.includes(task.task_type)) { setSaving(true); try { await onComplete(task.id) } finally { setSaving(false) }; return }
    setOpen(o => !o)
  }

  const handleSavePayment = async (e: React.MouseEvent) => {
    e.stopPropagation(); setSaving(true)
    try { await onComplete(task.id, { payment_status: payStatus }); setOpen(false) } finally { setSaving(false) }
  }
  const handleSavePrice = async (e: React.MouseEvent) => {
    e.stopPropagation(); if (!websitePrice || !b2bPrice) return; setSaving(true)
    try { await onComplete(task.id, { website_price: websitePrice, b2b_price: b2bPrice }); setOpen(false) } finally { setSaving(false) }
  }
  const handleSaveCost = async (e: React.MouseEvent) => {
    e.stopPropagation(); if (!cost) return; setSaving(true)
    try { await onComplete(task.id, { logistics_cost: cost, logistics_cost_currency: costCurrency }); setOpen(false) } finally { setSaving(false) }
  }
  const handleSaveLocation = async (e: React.MouseEvent) => {
    e.stopPropagation(); setSaving(true)
    try { await onComplete(task.id, { location_status: locStatus, location_from: locFrom.trim() || null, location_to: locTo.trim() || null }); setOpen(false) } finally { setSaving(false) }
  }

  return (
    <div className={`rounded-xl border transition-all ${task.is_completed ? 'bg-emerald-50/50 border-emerald-100' : 'bg-card border-default hover:border-strong'}`}>
      <div className={`flex items-center gap-2 px-3 py-2.5 select-none ${canComplete ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`} onClick={handleClick}>
        {/* Checkbox */}
        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${task.is_completed ? 'bg-emerald-500 border-emerald-500' : 'border-default hover:border-accent bg-card'}`}>
          {task.is_completed && <span className="text-white text-[10px] font-black leading-none">✓</span>}
          {saving && !task.is_completed && <span className="text-muted text-[10px] animate-spin inline-block">⟳</span>}
        </div>

        {/* Label */}
        <span className={`text-sm flex-1 leading-snug min-w-0 ${task.is_completed ? 'line-through text-muted' : 'text-ink font-medium'}`}>
          {TASK_LABELS[task.task_type] ?? task.task_type}
        </span>

        {/* Payment badge */}
        {task.task_type === 'ACCOUNTING_MARK_PAYMENT' && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${PAY_COLORS[task.watch.payment_status]}`}>{PAY_LABELS[task.watch.payment_status]}</span>
        )}

        {task.task_type === 'ACCOUNTING_ADD_STOCK_FOB' && task.watch.fob_url && (
          <a href={task.watch.fob_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            className="text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 bg-accent/10 text-accent border-accent/30 hover:bg-accent/15">
            Open FOB ↗
          </a>
        )}

        {task.task_type === 'ACCOUNTING_ADD_STOCK_FOB' && task.watch.stock_no && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 bg-panel text-muted border-default font-mono-data">#{task.watch.stock_no}</span>
        )}

        {/* Assignee picker */}
        {canAssign && (
          <AssigneePicker
            currentAssignee={task.assigned_to}
            teamMembers={teamMembers}
            onAssign={(name) => onAssign(task.id, name)}
          />
        )}

        {/* Expand arrow */}
        {hasInlineForm && !task.is_completed && (
          <span className={`text-muted text-xs transition-transform duration-150 flex-shrink-0 ${open ? 'rotate-180' : ''}`}>▾</span>
        )}
      </div>

      {open && !task.is_completed && (
        <div className="px-3 pb-3 border-t border-default" onClick={e => e.stopPropagation()}>
          {task.task_type === 'ACCOUNTING_MARK_PAYMENT' && (
            <div className="pt-2.5 flex flex-col gap-2">
              <div className="flex gap-1.5">
                {(['NOT_PAID', 'PARTIAL', 'PAID'] as PaymentStatus[]).map(s => (
                  <button key={s} type="button" onClick={() => setPayStatus(s)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${payStatus === s ? PAY_COLORS[s] : 'bg-panel border-default text-muted hover:border-accent/40'}`}>
                    {PAY_LABELS[s]}
                  </button>
                ))}
              </div>
              <button onClick={handleSavePayment} disabled={saving} className="btn-primary w-full py-1.5 text-xs disabled:opacity-50">{saving ? 'Saving…' : 'Save & Complete'}</button>
            </div>
          )}
          {task.task_type === 'SALES_SET_PRICE' && (
            <div className="pt-2.5 flex flex-col gap-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="section-label text-[10px] mb-1 block">Website $</label>
                  <input type="number" value={websitePrice} onChange={e => setWebsitePrice(e.target.value)} placeholder="0.00" className={compactInput} />
                </div>
                <div className="flex-1">
                  <label className="section-label text-[10px] mb-1 block">B2B $</label>
                  <input type="number" value={b2bPrice} onChange={e => setB2bPrice(e.target.value)} placeholder="0.00" className={compactInput} />
                </div>
              </div>
              <button onClick={handleSavePrice} disabled={saving || !websitePrice || !b2bPrice} className="btn-primary w-full py-1.5 text-xs disabled:opacity-50">{saving ? 'Saving…' : 'Save & Complete'}</button>
            </div>
          )}
          {task.task_type === 'LOGISTICS_UPDATE_COST' && (
            <div className="pt-2.5 flex flex-col gap-2">
              <div className="flex gap-2">
                <input type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="Cost amount" className={`${compactInput} flex-1`} />
                <select value={costCurrency} onChange={e => setCostCurrency(e.target.value)} className={compactInput}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={handleSaveCost} disabled={saving || !cost} className="btn-primary w-full py-1.5 text-xs disabled:opacity-50">{saving ? 'Saving…' : 'Save & Complete'}</button>
            </div>
          )}
          {task.task_type === 'LOGISTICS_SET_LOCATION' && (
            <div className="pt-2.5 flex flex-col gap-2">
              <div className="flex gap-1.5">
                {(['INCOMING', 'IN_TRANSIT', 'IN_STOCK'] as LocationStatus[]).map(s => (
                  <button key={s} type="button" onClick={() => setLocStatus(s)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all ${locStatus === s ? LOC_COLORS[s] : 'bg-panel border-default text-muted hover:border-accent/40'}`}>
                    {LOC_LABELS[s]}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="section-label text-[10px] mb-1 block">From</label>
                  <input type="text" value={locFrom} onChange={e => setLocFrom(e.target.value)} placeholder="e.g. Supplier" className={compactInput} />
                </div>
                <div className="flex-1">
                  <label className="section-label text-[10px] mb-1 block">Location / To</label>
                  <input type="text" value={locTo} onChange={e => setLocTo(e.target.value)} placeholder="e.g. London Office" className={compactInput} />
                </div>
              </div>
              <button onClick={handleSaveLocation} disabled={saving} className="btn-primary w-full py-1.5 text-xs disabled:opacity-50">{saving ? 'Saving…' : 'Save & Complete'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Accessories group ──────────────────────────────────────────────────────

interface AccessoriesGroupProps {
  tasks: WatchTask[]
  teamMembers: TeamMember[]
  canCompleteTask: (task: WatchTask) => boolean
  canAssign: boolean
  onComplete: (taskId: number, metadata?: Record<string, unknown>) => Promise<void>
  onUncomplete: (taskId: number) => Promise<void>
  onAssign: (taskId: number, name: string | null) => Promise<void>
}

function AccessoriesGroup({ tasks, teamMembers, canCompleteTask, canAssign, onComplete, onUncomplete, onAssign }: AccessoriesGroupProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)
  const [savingAll, setSavingAll] = useState(false)

  const completedCount = tasks.filter(t => t.is_completed).length
  const allDone = completedCount === tasks.length
  const someSelected = completedCount > 0 && !allDone

  const handleMainClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (savingAll || saving !== null) return
    const actionable = tasks.filter(t => canCompleteTask(t))
    if (actionable.length === 0) return
    setSavingAll(true)
    try {
      if (allDone) { await Promise.all(actionable.map(t => onUncomplete(t.id))) }
      else { await Promise.all(actionable.filter(t => !t.is_completed).map(t => onComplete(t.id))) }
    } finally { setSavingAll(false) }
  }

  const handleToggle = async (task: WatchTask) => {
    if (saving !== null || savingAll || !canCompleteTask(task)) return
    setSaving(task.id)
    try {
      if (task.is_completed) await onUncomplete(task.id)
      else await onComplete(task.id)
    } finally { setSaving(null) }
  }

  // Assignee for the group — pick the first non-null, or null
  const groupAssignee = tasks.find(t => t.assigned_to)?.assigned_to ?? null

  const handleGroupAssign = async (name: string | null) => {
    await Promise.all(tasks.map(t => onAssign(t.id, name)))
  }

  return (
    <div className={`rounded-xl border transition-all ${allDone ? 'bg-emerald-50/50 border-emerald-100' : someSelected ? 'bg-amber-50/30 border-amber-100' : 'bg-card border-default hover:border-strong'}`}>
      <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none" onClick={() => setOpen(o => !o)}>
        {/* Main checkbox */}
        <div onClick={handleMainClick}
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${allDone ? 'bg-emerald-500 border-emerald-500' : someSelected ? 'bg-white border-amber-400 hover:border-amber-500' : 'border-default hover:border-accent bg-card'}`}>
          {savingAll ? <span className="text-muted text-[10px] animate-spin inline-block">⟳</span>
            : allDone ? <span className="text-white text-[10px] font-black leading-none">✓</span>
            : someSelected ? <span className="text-amber-500 text-[10px] font-black leading-none">—</span>
            : null}
        </div>

        <span className={`text-sm flex-1 font-medium ${allDone ? 'line-through text-muted' : 'text-ink'}`}>Accessories</span>

        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${allDone ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : someSelected ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-panel text-muted border-default'}`}>
          {completedCount}/{tasks.length}
        </span>

        {/* Group assignee picker */}
        {canAssign && (
          <AssigneePicker
            currentAssignee={groupAssignee}
            teamMembers={teamMembers}
            onAssign={handleGroupAssign}
          />
        )}

        <span className={`text-muted text-xs transition-transform duration-150 flex-shrink-0 ${open ? 'rotate-180' : ''}`}>▾</span>
      </div>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-default flex flex-col gap-1">
          {tasks.map(task => (
            <div key={task.id} className={`flex items-center gap-2.5 py-1.5 px-1 rounded-lg transition-colors ${canCompleteTask(task) ? 'cursor-pointer hover:bg-panel' : 'cursor-not-allowed opacity-60'}`} onClick={() => handleToggle(task)}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${task.is_completed ? 'bg-emerald-500 border-emerald-500' : 'border-default hover:border-accent bg-card'}`}>
                {task.is_completed && <span className="text-white text-[8px] font-black leading-none">✓</span>}
                {saving === task.id && !task.is_completed && <span className="text-muted text-[8px] inline-block animate-spin">⟳</span>}
              </div>
              <span className={`text-sm flex-1 ${task.is_completed ? 'line-through text-muted' : 'text-muted'}`}>
                {ACCESSORY_LABELS[task.task_type] ?? task.task_type}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Watch accordion ────────────────────────────────────────────────────────

interface WatchAccordionProps {
  watchId: number; watchName: string; tasks: WatchTask[]
  teamMembers: TeamMember[]; expanded: boolean; onToggle: () => void
  canCompleteTask: (task: WatchTask) => boolean
  canAssign: boolean
  onComplete: (taskId: number, metadata?: Record<string, unknown>) => Promise<void>
  onUncomplete: (taskId: number) => Promise<void>
  onAssign: (taskId: number, name: string | null) => Promise<void>
  onRefresh: () => void
}

function WatchAccordion({ watchId, watchName, tasks, teamMembers, expanded, onToggle, canCompleteTask, canAssign, onComplete, onUncomplete, onAssign, onRefresh }: WatchAccordionProps) {
  const [assigning, setAssigning] = useState(false)
  const [assignDone, setAssignDone] = useState(false)

  const pending = tasks.filter(t => !t.is_completed && !t.is_locked).length
  const allDone = pending === 0

  const deptTasks: Record<Department, WatchTask[]> = {
    ACCOUNTING: tasks.filter(t => t.department === 'ACCOUNTING'),
    SALES:      tasks.filter(t => t.department === 'SALES'),
    LOGISTICS:  tasks.filter(t => t.department === 'LOGISTICS'),
  }

  const handleAutoAssign = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (assigning) return
    setAssigning(true)
    try {
      await fetch(`/api/watches/${watchId}/assign-tasks`, { method: 'POST' })
      setAssignDone(true)
      onRefresh()
      setTimeout(() => setAssignDone(false), 3000)
    } finally { setAssigning(false) }
  }

  return (
    <div id={`watch-tasks-${watchId}`} className={`rounded-2xl border overflow-hidden mb-3 ${allDone ? 'border-emerald-200' : 'border-default'}`}>
      {/* Header */}
      <div className={`flex items-center gap-2 px-4 py-3.5 ${allDone ? 'bg-emerald-50' : 'bg-card'}`}>
        <button onClick={onToggle} className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${allDone ? 'bg-emerald-500' : 'bg-accent'}`} />
          <span className={`font-display font-bold text-base truncate ${allDone ? 'text-emerald-800' : 'text-ink'}`}>{watchName}</span>
        </button>

        {/* Auto assign button */}
        {canAssign && (
          <button onClick={handleAutoAssign} disabled={assigning}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex-shrink-0 disabled:opacity-50 ${
              assignDone ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-accent/10 text-accent border-accent/30 hover:bg-accent/15'
            }`}>
            {assigning ? <><span className="animate-spin inline-block">⟳</span> Assigning…</>
              : assignDone ? <>✓ Assigned</>
              : <>👤 Auto Assign</>}
          </button>
        )}

        {allDone
          ? <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 flex-shrink-0">✓ Done</span>
          : <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/30 flex-shrink-0">{pending} left</span>
        }

        <button onClick={onToggle} className="flex-shrink-0 pl-1">
          <span className={`text-muted text-sm transition-transform duration-200 inline-block ${expanded ? 'rotate-180' : ''}`}>▾</span>
        </button>
      </div>

      {/* Department sections */}
      {expanded && (
        <div className="border-t border-default">
          {DEPT_ORDER.map(dept => {
            const dt = deptTasks[dept]
            if (!dt || dt.length === 0) return null
            const cfg = DEPT_CONFIG[dept]
            const deptPending = dt.filter(t => !t.is_completed && !t.is_locked).length
            const deptDone = deptPending === 0
            const mainTasks = dt.filter(t => !ACCESSORY_TASK_TYPES.includes(t.task_type))
            const accessoryTasks = dt.filter(t => ACCESSORY_TASK_TYPES.includes(t.task_type))

            return (
              <div key={dept} className={`px-3 py-3 ${dept !== 'LOGISTICS' ? 'border-b border-default' : ''}`}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl mb-2.5 ${cfg.bg}`}>
                  <span className="text-sm">{cfg.icon}</span>
                  <span className={`section-label text-[10px] ${cfg.color}`}>{cfg.label}</span>
                  <span className={`ml-auto text-[10px] font-bold ${deptDone ? 'text-emerald-600' : cfg.color}`}>
                    {deptDone ? '✓ Done' : `${deptPending} left`}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {mainTasks.map(task => (
                    <TaskRow key={task.id} task={task} teamMembers={teamMembers} canComplete={canCompleteTask(task)} canAssign={canAssign} onComplete={onComplete} onUncomplete={onUncomplete} onAssign={onAssign} />
                  ))}
                  {accessoryTasks.length > 0 && (
                    <AccessoriesGroup tasks={accessoryTasks} teamMembers={teamMembers} canCompleteTask={canCompleteTask} canAssign={canAssign} onComplete={onComplete} onUncomplete={onUncomplete} onAssign={onAssign} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────

export default function WatchTaskPanel({ className, focusedWatchId }: { className?: string; focusedWatchId?: number | null }) {
  const [tasks, setTasks] = useState<WatchTask[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedWatchId, setExpandedWatchId] = useState<number | null>(null)
  const {
    myTasksOnly, setMyTasksOnly, myName, setMyName, sort, setSort,
    deptFilter, filterByAssignee, clearMyTasksFilter,
  } = useWatchTaskFilters()
  const { member, canCompleteWatchTask, canAssignWatchTask } = useCurrentMember()
  const filtersActive = myTasksOnly || !!deptFilter

  useEffect(() => {
    if (member?.name) setMyName(member.name)
  }, [member, setMyName])

  useEffect(() => {
    if (focusedWatchId != null) {
      setExpandedWatchId(focusedWatchId)
      requestAnimationFrame(() => {
        document.getElementById(`watch-tasks-${focusedWatchId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [focusedWatchId])

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/watch-tasks')
      if (res.ok) setTasks(await res.json())
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

  useEffect(() => {
    let es: EventSource | null = null
    const connect = () => {
      es = new EventSource('/api/sse')
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (['task_completed', 'task_unlocked', 'task_updated', 'new_watch', 'watch_updated', 'watch_sold'].includes(data.type)) fetchTasks()
        } catch { /* ignore pings */ }
      }
      es.onerror = () => { es?.close(); setTimeout(connect, 5000) }
    }
    connect()
    return () => es?.close()
  }, [fetchTasks])

  const completeTask = useCallback(async (taskId: number, metadata?: Record<string, unknown>) => {
    const res = await fetch(`/api/watch-tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: true, ...(metadata ? { metadata } : {}) }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks(prev => prev.map(t => {
        if (t.id !== taskId) return t
        const watchUpdates: Partial<WatchInfo> = {}
        if (metadata?.payment_status) watchUpdates.payment_status = metadata.payment_status as PaymentStatus
        if (metadata?.website_price) watchUpdates.website_price = metadata.website_price as number
        if (metadata?.b2b_price) watchUpdates.b2b_price = metadata.b2b_price as number
        if (metadata?.logistics_cost !== undefined) watchUpdates.logistics_cost = parseFloat(String(metadata.logistics_cost))
        if (metadata?.logistics_cost_currency) watchUpdates.logistics_cost_currency = metadata.logistics_cost_currency as string
        return { ...t, ...updated, watch: { ...t.watch, ...watchUpdates } }
      }))
      if (updated.task_type === 'ACCOUNTING_MARK_PAYMENT') fetchTasks()
    }
  }, [fetchTasks])

  const uncompleteTask = useCallback(async (taskId: number) => {
    const res = await fetch(`/api/watch-tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: false }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updated } : t))
    }
  }, [])

  const assignTask = useCallback(async (taskId: number, name: string | null) => {
    const res = await fetch(`/api/watch-tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: name }),
    })
    if (res.ok) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assigned_to: name } : t))
    }
  }, [])

  // Group by watch
  const filteredTasks = filterByAssignee(tasks)

  const byWatch = new Map<number, { watchId: number; watchName: string; tasks: WatchTask[] }>()
  for (const task of filteredTasks) {
    if (!byWatch.has(task.watch_id)) {
      const wName = [task.watch.brand, task.watch.model].filter(Boolean).join(' ') || task.watch.name
      byWatch.set(task.watch_id, { watchId: task.watch_id, watchName: wName, tasks: [] })
    }
    byWatch.get(task.watch_id)!.tasks.push(task)
  }

  let watchGroups = Array.from(byWatch.values())
  if (sort === 'new') watchGroups = watchGroups.sort((a, b) => b.watchId - a.watchId)
  else if (sort === 'pending') watchGroups = watchGroups.sort((a, b) => b.tasks.filter(t => !t.is_completed && !t.is_locked).length - a.tasks.filter(t => !t.is_completed && !t.is_locked).length)
  else watchGroups = watchGroups.sort((a, b) => a.watchName.localeCompare(b.watchName))

  const totalPending = filteredTasks.filter(t => !t.is_completed && !t.is_locked).length

  if (loading) return <div className={`flex items-center justify-center h-40 text-muted ${className}`}>Loading tasks…</div>
  if (tasks.length === 0) return (
    <div className={`flex flex-col items-center justify-center h-48 text-muted gap-3 px-6 text-center ${className}`}>
      <span className="text-4xl">📋</span>
      <p className="font-semibold text-lg text-ink">No buy tasks yet</p>
      <p className="text-sm">Add a buy watch — tasks are created automatically</p>
    </div>
  )

  return (
    <div className={className}>
      <div className="p-4">
        <WatchTaskToolbar
          totalPending={totalPending}
          watchCount={watchGroups.length}
          myTasksOnly={myTasksOnly}
          onMyTasksOnlyChange={setMyTasksOnly}
          myName={myName}
          onMyNameChange={setMyName}
          teamMembers={teamMembers}
          sort={sort}
          onSortChange={setSort}
          filtersActive={filtersActive}
          onShowAllTasks={clearMyTasksFilter}
        />

        {filteredTasks.length === 0 ? (
          <WatchTaskEmptyFilter onShowAll={clearMyTasksFilter} />
        ) : (
          watchGroups.map(({ watchId, watchName, tasks: watchTasks }) => (
            <WatchAccordion
              key={watchId}
              watchId={watchId}
              watchName={watchName}
              tasks={watchTasks}
              teamMembers={teamMembers}
              expanded={expandedWatchId === watchId}
              onToggle={() => setExpandedWatchId(prev => prev === watchId ? null : watchId)}
              canCompleteTask={canCompleteWatchTask}
              canAssign={canAssignWatchTask}
              onComplete={completeTask}
              onUncomplete={uncompleteTask}
              onAssign={assignTask}
              onRefresh={fetchTasks}
            />
          ))
        )}
      </div>
    </div>
  )
}
