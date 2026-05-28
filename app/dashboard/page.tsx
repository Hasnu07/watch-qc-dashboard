'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import WatchCard from '@/components/WatchCard'
import AddWatchModal from '@/components/AddWatchModal'
import PasteMessageModal from '@/components/PasteMessageModal'
import WatchDetailModal, { type WatchDetail } from '@/components/WatchDetailModal'
import WatchTaskPanel from '@/components/WatchTaskPanel'
import WatchSellTaskPanel from '@/components/WatchSellTaskPanel'
import AutoScrollList from '@/components/AutoScrollList'
import ConfirmRemoveModal from '@/components/ConfirmRemoveModal'
import InventoryToolbar, { type InventoryFilters } from '@/components/InventoryToolbar'
import ImportInboxPanel from '@/components/ImportInboxPanel'
import CommandPalette from '@/components/CommandPalette'
import SkeletonCard from '@/components/SkeletonCard'
import { formatCurrency } from '@/lib/utils'
import { useSseStatus } from '@/components/SseProvider'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { DEPT_ORDER, DEPT_CONFIG, type Department } from '@/lib/ui-constants'

type WatchStage = 'LOGISTICS' | 'ACCOUNTING' | 'SALES'
type PaymentStatus = 'NOT_PAID' | 'PARTIAL' | 'PAID'
type LocationStatus = 'INCOMING' | 'IN_TRANSIT' | 'IN_STOCK'

type DeptCount = { total: number; completed: number }
type TaskSummary = Record<'LOGISTICS' | 'ACCOUNTING' | 'SALES', DeptCount>

interface Watch {
  id: number
  name: string
  brand: string | null
  model: string | null
  ref_no: string | null
  serial_no: string | null
  stock_no: string | null
  watch_date: string | null
  bought_from: string | null
  currency: string
  purchase_price: string | number | null
  convert_rate: string | number | null
  case_material: string | null
  dial_colour: string | null
  bracelet: string | null
  stock_status: string
  origin: string | null
  image_url: string | null
  website_price: string | number
  b2b_price: string | number
  stage: WatchStage
  is_sold: boolean
  payment_status: PaymentStatus
  total_amount: number | null
  location_status: LocationStatus
  location_from: string | null
  location_to: string | null
  transit_pickup_date: string | null
  transit_carrier: string | null
  transit_tracking_number: string | null
  received_date: string | null
  watch_type?: 'BUY' | 'SELL'
  sold_to?: string | null
  task_summary?: TaskSummary
  margin?: number | null
  is_stale?: boolean
  stale_reason?: string | null
  linked_buy_watch_id?: number | null
  fob_url?: string | null
  created_at?: string
}

interface PipelineStats {
  total_watches: number
  total_pipeline_value: number
  stale_count: number
  avg_sell_margin: number | null
}

function hasIncompleteDept(watch: Watch, dept: Department): boolean {
  const s = watch.task_summary?.[dept]
  return !!s && s.total > 0 && s.completed < s.total
}

function matchesSearch(watch: Watch, q: string): boolean {
  if (!q) return true
  const hay = [
    watch.name, watch.brand, watch.model, watch.ref_no, watch.stock_no,
    watch.bought_from, watch.sold_to, watch.serial_no,
  ].filter(Boolean).join(' ').toLowerCase()
  return hay.includes(q.toLowerCase())
}

export default function DashboardPage() {
  const { connected: sseConnected } = useSseStatus()
  const [watches, setWatches] = useState<Watch[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddWatch, setShowAddWatch] = useState(false)
  const [addWatchStock, setAddWatchStock] = useState('')
  const [showPasteMessage, setShowPasteMessage] = useState(false)
  const [showActionSheet, setShowActionSheet] = useState(false)
  const [selectedWatch, setSelectedWatch] = useState<Watch | null>(null)
  const [removeTarget, setRemoveTarget] = useState<Watch | null>(null)
  const [activeTab, setActiveTab] = useState<'inventory' | 'tasks' | 'sell' | 'add'>('inventory')
  const [taskTab, setTaskTab] = useState<'buy' | 'sell'>('buy')
  const [focusedWatchId, setFocusedWatchId] = useState<number | null>(null)
  const [deptFilter, setDeptFilter] = useState<Department | null>(null)
  const [autoScroll, setAutoScroll] = useState(false)
  const [compactMode, setCompactMode] = useState(false)
  const [filters, setFilters] = useState<InventoryFilters>({
    search: '', watchType: 'all', payment: 'all', location: 'all',
  })
  const [quickStock, setQuickStock] = useState('')
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [undoRemove, setUndoRemove] = useState<{ id: number; watch: Watch; timer: ReturnType<typeof setTimeout> } | null>(null)

  const fetchWatches = useCallback(async () => {
    try {
      const res = await fetch('/api/watches')
      if (res.ok) {
        const data = await res.json()
        setWatches(Array.isArray(data) ? data : (data.watches || []))
        if (data.stats) setPipelineStats(data.stats)
      }
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchWatches() }, [fetchWatches])

  useEffect(() => {
    const handler = () => fetchWatches()
    window.addEventListener('qc-dashboard-refresh', handler)
    return () => window.removeEventListener('qc-dashboard-refresh', handler)
  }, [fetchWatches])

  useEffect(() => {
    setAutoScroll(localStorage.getItem('qc-autoscroll') === '1')
    setCompactMode(localStorage.getItem('qc-compact-cards') === '1' || window.innerWidth < 768)
  }, [])

  useKeyboardShortcuts({
    onSearch: () => document.querySelector<HTMLInputElement>('input[type="search"]')?.focus(),
    onNewWatch: () => { setAddWatchStock(''); setShowAddWatch(true) },
    onCommandPalette: () => setShowCommandPalette(true),
  })

  const filteredWatches = useMemo(() => {
    return watches.filter(w => {
      if (!matchesSearch(w, filters.search.trim())) return false
      if (filters.watchType === 'BUY' && w.watch_type === 'SELL') return false
      if (filters.watchType === 'SELL' && w.watch_type !== 'SELL') return false
      if (filters.payment !== 'all' && w.payment_status !== filters.payment) return false
      if (filters.location !== 'all' && w.location_status !== filters.location) return false
      if (deptFilter && !hasIncompleteDept(w, deptFilter) && w.stage !== deptFilter) return false
      return true
    })
  }, [watches, filters, deptFilter])

  const buyWatches = filteredWatches.filter(w => w.watch_type !== 'SELL')
  const sellWatches = filteredWatches.filter(w => w.watch_type === 'SELL')
  const focusedWatch = focusedWatchId ? watches.find(w => w.id === focusedWatchId) : null

  const handleRemove = async (id: number) => {
    const watch = watches.find(w => w.id === id)
    if (!watch) return
    setRemoveTarget(null)
    if (undoRemove) {
      clearTimeout(undoRemove.timer)
      setUndoRemove(null)
    }
    setWatches(prev => prev.filter(w => w.id !== id))
    if (selectedWatch?.id === id) setSelectedWatch(null)
    if (focusedWatchId === id) setFocusedWatchId(null)
    const timer = setTimeout(async () => {
      setUndoRemove(null)
      try {
        const res = await fetch(`/api/watches/${id}`, { method: 'DELETE' })
        if (!res.ok) fetchWatches()
      } catch { fetchWatches() }
    }, 8000)
    setUndoRemove({ id, watch, timer })
  }

  const undoRemoveAction = () => {
    if (!undoRemove) return
    clearTimeout(undoRemove.timer)
    setWatches(prev => [...prev, undoRemove.watch])
    setUndoRemove(null)
  }

  const handleOpenTasks = (watch: Watch) => {
    const isSell = watch.watch_type === 'SELL'
    setFocusedWatchId(watch.id)
    setTaskTab(isSell ? 'sell' : 'buy')
    setActiveTab(isSell ? 'sell' : 'tasks')
  }

  const openAddWithStock = (stock: string) => {
    setAddWatchStock(stock.replace(/^#/, '').trim())
    setShowAddWatch(true)
    setShowActionSheet(false)
    setActiveTab('inventory')
  }

  const deptCounts = DEPT_ORDER.reduce((acc, dept) => {
    acc[dept] = watches.filter(w => hasIncompleteDept(w, dept) || w.stage === dept).length
    return acc
  }, {} as Record<Department, number>)

  const toggleAutoScroll = () => {
    const next = !autoScroll
    setAutoScroll(next)
    localStorage.setItem('qc-autoscroll', next ? '1' : '0')
  }

  const toggleCompact = (v: boolean) => {
    setCompactMode(v)
    localStorage.setItem('qc-compact-cards', v ? '1' : '0')
  }

  const TaskListWrapper = ({ children }: { children: React.ReactNode }) =>
    autoScroll ? (
      <AutoScrollList className="flex-1" speedPxPerSec={40}>{children}</AutoScrollList>
    ) : (
      <div className="flex-1 overflow-y-auto">{children}</div>
    )

  return (
    <div className="flex flex-col flex-1 overflow-hidden pb-14 md:pb-0">

      {/* Mobile top tabs */}
      <div className="flex md:hidden border-b border-default bg-white sticky top-0 z-40">
        {([
          ['inventory', '⌚ Inventory', watches.length, 'indigo'],
          ['tasks', '✅ Buy Tasks', null, 'indigo'],
          ['sell', '🏷️ Sell Tasks', null, 'orange'],
        ] as const).map(([tab, label, count, color]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === tab
                ? color === 'orange' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-muted'
            }`}>
            {label}
            {count != null && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${activeTab === tab ? 'bg-indigo-50 text-indigo-600' : 'bg-panel text-muted'}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — Inventory */}
        <div className={`flex-col w-full md:w-[58%] border-r border-default overflow-hidden ${activeTab === 'inventory' ? 'flex' : 'hidden'} md:flex`}>
          <div className="px-4 py-4 border-b border-default bg-white sm:px-6 sm:py-5">
            <div className="flex items-center justify-between mb-3 sm:mb-4 gap-2">
              <div>
                <h2 className="text-xl font-black text-ink sm:text-2xl">Watch Pipeline</h2>
                <p className="text-muted text-xs mt-0.5 font-medium sm:text-sm">
                  {buyWatches.length} buy · {sellWatches.length} sell · {watches.length} total
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${sseConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-emerald-500 live-dot' : 'bg-amber-400'}`} />
                  {sseConnected ? 'Live' : 'Polling'}
                </div>
                <button onClick={() => setShowCommandPalette(true)} title="Command palette (⌘K)"
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-bold text-sm">
                  ⌘K
                </button>
                <a href="/api/watches/export" download
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full font-bold text-sm">
                  ↓ CSV
                </a>
                <button onClick={() => setShowPasteMessage(true)} title="Paste WhatsApp message"
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-bold text-sm">
                  <span>📋</span><span className="hidden sm:inline">Paste</span>
                </button>
                <button onClick={() => { setAddWatchStock(''); setShowAddWatch(true) }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold text-sm sm:px-5">
                  <span className="text-lg leading-none font-black">+</span>
                  <span className="hidden sm:inline">Add Watch</span>
                </button>
              </div>
            </div>

            {pipelineStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <div className="rounded-xl bg-white border border-default px-3 py-2">
                  <div className="text-[9px] font-bold uppercase text-muted tracking-wider">Pipeline value</div>
                  <div className="text-sm font-black text-ink">{formatCurrency(pipelineStats.total_pipeline_value)}</div>
                </div>
                <div className="rounded-xl bg-white border border-default px-3 py-2">
                  <div className="text-[9px] font-bold uppercase text-muted tracking-wider">Stale</div>
                  <div className={`text-sm font-black ${pipelineStats.stale_count ? 'text-amber-700' : 'text-ink'}`}>{pipelineStats.stale_count}</div>
                </div>
                <div className="rounded-xl bg-white border border-default px-3 py-2">
                  <div className="text-[9px] font-bold uppercase text-muted tracking-wider">Avg sell margin</div>
                  <div className="text-sm font-black text-ink">{pipelineStats.avg_sell_margin != null ? formatCurrency(pipelineStats.avg_sell_margin) : '—'}</div>
                </div>
                <div className="rounded-xl bg-white border border-default px-3 py-2">
                  <div className="text-[9px] font-bold uppercase text-muted tracking-wider">On pipeline</div>
                  <div className="text-sm font-black text-ink">{pipelineStats.total_watches}</div>
                </div>
              </div>
            )}

            <ImportInboxPanel onImported={fetchWatches} />

            {/* Stock-first quick entry */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={quickStock}
                onChange={e => setQuickStock(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && quickStock.trim()) openAddWithStock(quickStock) }}
                placeholder="Enter stock # to add…"
                className="flex-1 bg-panel border border-default rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
              <button type="button" disabled={!quickStock.trim()}
                onClick={() => openAddWithStock(quickStock)}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-40">
                Go
              </button>
            </div>

            <InventoryToolbar
              filters={filters}
              onChange={setFilters}
              compactMode={compactMode}
              onCompactModeChange={toggleCompact}
            />

            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3">
              {DEPT_ORDER.map(dept => {
                const cfg = DEPT_CONFIG[dept]
                const active = deptFilter === dept
                return (
                  <button key={dept} type="button" onClick={() => setDeptFilter(active ? null : dept)}
                    className={`${cfg.bg} rounded-xl px-2.5 py-2 flex items-center gap-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:gap-3 text-left transition-all ${active ? 'ring-2 ring-indigo-400 ring-offset-1' : 'hover:opacity-90'}`}>
                    <span className="text-lg sm:text-2xl">{cfg.icon}</span>
                    <div>
                      <div className={`text-[9px] font-bold uppercase tracking-widest sm:text-xs ${cfg.color}`}>{cfg.label}</div>
                      <div className={`font-black text-xl leading-none sm:text-2xl ${cfg.countColor}`}>{deptCounts[dept]}</div>
                    </div>
                  </button>
                )
              })}
            </div>
            {deptFilter && (
              <button type="button" onClick={() => setDeptFilter(null)} className="mt-2 text-xs text-indigo-600 font-bold hover:underline">
                Clear department filter
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 bg-panel sm:p-5 space-y-6">
            {loading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
              </div>
            ) : watches.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 min-h-[280px] text-center px-4">
                <div className="w-20 h-20 rounded-full bg-panel border border-default flex items-center justify-center text-4xl">⌚</div>
                <p className="text-base font-semibold text-muted">No watches on pipeline</p>
                <p className="text-sm text-muted max-w-xs">Paste a WhatsApp message or enter a stock number to get started.</p>
                <div className="flex gap-2">
                  <button onClick={() => setShowPasteMessage(true)} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-semibold text-sm">📋 Paste message</button>
                  <button onClick={() => setShowAddWatch(true)} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-semibold text-sm">+ Add watch</button>
                </div>
              </div>
            ) : filteredWatches.length === 0 ? (
              <div className="text-center py-12 text-muted">
                <p className="font-semibold">No watches match your filters</p>
                <button type="button" onClick={() => { setFilters({ search: '', watchType: 'all', payment: 'all', location: 'all' }); setDeptFilter(null) }}
                  className="mt-2 text-sm text-indigo-600 font-bold hover:underline">Clear all filters</button>
              </div>
            ) : (
              <>
                <section>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-1 h-6 rounded-full bg-indigo-500" />
                    <h3 className="text-sm font-black text-indigo-800 uppercase tracking-wider">Buy Inventory</h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{buyWatches.length}</span>
                  </div>
                  {buyWatches.length === 0 ? (
                    <p className="text-sm text-muted px-1 py-4 text-center bg-indigo-50/50 rounded-xl border border-indigo-100 border-dashed">
                      No buy watches match — paste a purchase message or add stock #
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                      {buyWatches.map(watch => (
                        <WatchCard key={watch.id} watch={watch} compact={compactMode}
                          highlighted={focusedWatchId === watch.id}
                          searchHighlight={filters.search.trim()}
                          onCardClick={setSelectedWatch}
                          onRemoveRequest={setRemoveTarget}
                          onOpenTasks={handleOpenTasks} />
                      ))}
                    </div>
                  )}
                </section>
                <section>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-1 h-6 rounded-full bg-orange-500" />
                    <h3 className="text-sm font-black text-orange-800 uppercase tracking-wider">Sell Inventory</h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{sellWatches.length}</span>
                  </div>
                  {sellWatches.length === 0 ? (
                    <p className="text-sm text-muted px-1 py-4 text-center bg-orange-50/50 rounded-xl border border-orange-100 border-dashed">
                      No sell watches match — paste a sold message
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                      {sellWatches.map(watch => (
                        <WatchCard key={watch.id} watch={watch} compact={compactMode}
                          highlighted={focusedWatchId === watch.id}
                          searchHighlight={filters.search.trim()}
                          onCardClick={setSelectedWatch}
                          onRemoveRequest={setRemoveTarget}
                          onOpenTasks={handleOpenTasks} />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </div>

        {/* RIGHT — Tasks */}
        <div className={`flex-col w-full md:w-[42%] overflow-hidden ${activeTab === 'tasks' || activeTab === 'sell' ? 'flex' : 'hidden'} md:flex`}>
          <div className="flex items-center justify-between px-4 py-4 border-b border-default bg-white sm:px-6 sm:py-5">
            <div className="flex items-center gap-2 min-w-0">
              <button type="button" onClick={() => setActiveTab('inventory')}
                className="md:hidden flex-shrink-0 w-9 h-9 rounded-full bg-panel border border-default text-ink font-bold text-lg leading-none">
                ←
              </button>
              <div className="min-w-0">
                <h2 className="text-xl font-black text-ink sm:text-2xl">Watch Tasks</h2>
              {focusedWatch ? (
                <p className="text-indigo-600 text-xs mt-0.5 font-bold sm:text-sm truncate max-w-[240px] sm:max-w-none">
                  → #{focusedWatch.stock_no || focusedWatch.id} {focusedWatch.brand} {focusedWatch.model}
                </p>
              ) : (
                <p className="text-muted text-xs mt-0.5 font-medium sm:text-sm">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={toggleAutoScroll}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${autoScroll ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-white text-muted border-default'}`}>
                {autoScroll ? '⏸ Auto-scroll on' : '▶ Auto-scroll'}
              </button>
            </div>
          </div>

          <div className="flex border-b border-default bg-white px-4 gap-1 pt-2">
            <button onClick={() => { setTaskTab('buy'); setActiveTab('tasks') }}
              className={`px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 ${taskTab === 'buy' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-muted'}`}>
              🛒 Buy Tasks
            </button>
            <button onClick={() => { setTaskTab('sell'); setActiveTab('sell') }}
              className={`px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 ${taskTab === 'sell' ? 'border-orange-500 text-orange-600' : 'border-transparent text-muted'}`}>
              🏷️ Sell Tasks
            </button>
          </div>

          {taskTab === 'buy' ? (
            <TaskListWrapper>
              <WatchTaskPanel focusedWatchId={taskTab === 'buy' ? focusedWatchId : null} />
            </TaskListWrapper>
          ) : (
            <TaskListWrapper>
              <WatchSellTaskPanel focusedWatchId={taskTab === 'sell' ? focusedWatchId : null} />
            </TaskListWrapper>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-default z-50 flex">
        {([
          ['inventory', '⌚', 'Stock'],
          ['tasks', '✅', 'Buy'],
          ['sell', '🏷️', 'Sell'],
          ['add', '＋', 'Add'],
        ] as const).map(([tab, icon, label]) => (
          <button key={tab} type="button"
            onClick={() => tab === 'add' ? setShowActionSheet(true) : setActiveTab(tab)}
            className={`flex-1 py-2 flex flex-col items-center gap-0.5 text-[10px] font-bold ${activeTab === tab ? 'text-indigo-600' : 'text-muted'}`}>
            <span className="text-lg">{icon}</span>{label}
          </button>
        ))}
      </div>

      {showActionSheet && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 md:hidden flex items-end" onClick={() => setShowActionSheet(false)}>
          <div className="bg-white w-full rounded-t-3xl p-5 space-y-2" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-black text-ink mb-3">Add watch</p>
            <button onClick={() => { setShowPasteMessage(true); setShowActionSheet(false) }}
              className="w-full py-3 rounded-xl bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">📋 Paste WhatsApp message</button>
            <button onClick={() => { setAddWatchStock(''); setShowAddWatch(true); setShowActionSheet(false) }}
              className="w-full py-3 rounded-xl bg-indigo-50 text-indigo-800 font-bold border border-indigo-200">+ Full add form</button>
            <div className="flex gap-2 pt-1">
              <input type="text" value={quickStock} onChange={e => setQuickStock(e.target.value)} placeholder="Stock #"
                className="flex-1 border border-default rounded-xl px-3 py-2 text-sm" />
              <button onClick={() => openAddWithStock(quickStock)} disabled={!quickStock.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm disabled:opacity-40">Go</button>
            </div>
          </div>
        </div>
      )}

      {showAddWatch && (
        <AddWatchModal initialStockNo={addWatchStock} onClose={() => { setShowAddWatch(false); setAddWatchStock('') }} onAdded={fetchWatches} />
      )}
      {showPasteMessage && (
        <PasteMessageModal
          onClose={() => setShowPasteMessage(false)}
          onImported={fetchWatches}
          onViewWatch={(id) => {
            fetch(`/api/watches/${id}`).then(r => r.ok ? r.json() : null).then(w => { if (w) setSelectedWatch(w) })
            fetchWatches()
          }}
        />
      )}
      {selectedWatch && (
        <WatchDetailModal watch={selectedWatch as WatchDetail} onClose={() => setSelectedWatch(null)} onUpdated={fetchWatches} />
      )}
      {removeTarget && (
        <ConfirmRemoveModal watchName={removeTarget.name} stockNo={removeTarget.stock_no}
          onCancel={() => setRemoveTarget(null)} onConfirm={() => handleRemove(removeTarget.id)} />
      )}
      {showCommandPalette && (
        <CommandPalette
          watches={watches}
          onClose={() => setShowCommandPalette(false)}
          onSelectStock={openAddWithStock}
          onPaste={() => setShowPasteMessage(true)}
          onAddWatch={() => { setAddWatchStock(''); setShowAddWatch(true) }}
          onOpenWatch={(id) => {
            const w = watches.find(x => x.id === id)
            if (w) setSelectedWatch(w)
          }}
        />
      )}
      {undoRemove && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-xl shadow-lg text-sm">
          <span>Removed #{undoRemove.watch.stock_no || undoRemove.watch.id}</span>
          <button type="button" onClick={undoRemoveAction} className="font-bold text-indigo-300 hover:text-indigo-200">Undo</button>
        </div>
      )}
    </div>
  )
}
