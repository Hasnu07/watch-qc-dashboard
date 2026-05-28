'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import WatchCard from '@/components/WatchCard'
import AddWatchModal from '@/components/AddWatchModal'
import PasteMessageModal from '@/components/PasteMessageModal'
import WatchDetailModal, { type WatchDetail } from '@/components/WatchDetailModal'
import WatchTaskPanel from '@/components/WatchTaskPanel'
import WatchSellTaskPanel from '@/components/WatchSellTaskPanel'
import AutoScrollList from '@/components/AutoScrollList'
import AutoScrollViewport from '@/components/AutoScrollViewport'
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
  const [inventoryTvScroll, setInventoryTvScroll] = useState(false)
  const [tasksPinned, setTasksPinned] = useState(true)
  const [showTasksPanel, setShowTasksPanel] = useState(true)
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
    setInventoryTvScroll(localStorage.getItem('qc-inventory-tv-scroll') === '1')
    const pinned = localStorage.getItem('qc-tasks-pinned') !== '0'
    setTasksPinned(pinned)
    setShowTasksPanel(pinned || localStorage.getItem('qc-show-tasks') !== '0')
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

  const toggleInventoryTvScroll = () => {
    const next = !inventoryTvScroll
    setInventoryTvScroll(next)
    localStorage.setItem('qc-inventory-tv-scroll', next ? '1' : '0')
  }

  const exitTvMode = () => {
    setInventoryTvScroll(false)
    localStorage.setItem('qc-inventory-tv-scroll', '0')
  }

  const toggleTasksPinned = () => {
    const next = !tasksPinned
    setTasksPinned(next)
    localStorage.setItem('qc-tasks-pinned', next ? '1' : '0')
    if (next) {
      setShowTasksPanel(true)
      localStorage.setItem('qc-show-tasks', '1')
    }
  }

  const toggleShowTasksPanel = () => {
    if (tasksPinned) return
    const next = !showTasksPanel
    setShowTasksPanel(next)
    localStorage.setItem('qc-show-tasks', next ? '1' : '0')
  }

  const toggleCompact = (v: boolean) => {
    setCompactMode(v)
    localStorage.setItem('qc-compact-cards', v ? '1' : '0')
  }

  const TaskListWrapper = ({ children }: { children: React.ReactNode }) =>
    autoScroll ? (
      <AutoScrollList className="flex-1 min-h-0" speedPxPerSec={50} enabled={autoScroll}>{children}</AutoScrollList>
    ) : (
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    )

  const leftWidthClass = showTasksPanel
    ? 'w-full md:w-[58%] md:max-w-[58%] md:flex-[0_0_58%] shrink-0'
    : 'w-full flex-1 min-w-0'
  const panelHeightClass = inventoryTvScroll
    ? 'h-[calc(100dvh-5.25rem)] max-h-[calc(100dvh-5.25rem)]'
    : 'h-full max-h-full'
  const inventoryGridClass = inventoryTvScroll
    ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4'
    : 'grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-2 2xl:grid-cols-3'

  return (
    <div className="flex flex-col flex-1 overflow-hidden pb-14 md:pb-0">

      {/* Mobile top tabs */}
      <div className="flex md:hidden border-b border-default bg-card sticky top-0 z-40">
        {([
          ['inventory', 'Inventory', watches.length],
          ['tasks', 'Buy Tasks', null],
          ['sell', 'Sell Tasks', null],
        ] as const).map(([tab, label, count]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === tab ? 'text-accent border-b-2 border-accent' : 'text-muted'
            }`}>
            {label}
            {count != null && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === tab ? 'bg-accent/10 text-accent' : 'bg-panel text-muted'}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0 h-full w-full">
        {/* LEFT — Inventory */}
        <div className={`flex flex-col min-h-0 ${leftWidthClass} ${panelHeightClass} border-r border-default overflow-hidden ${activeTab === 'inventory' ? 'flex' : 'hidden'} md:flex`}>
          <div className={`px-4 border-b border-default bg-card sm:px-8 flex-shrink-0 ${inventoryTvScroll ? 'py-3' : 'py-5 sm:py-6'}`}>
            <div className={`flex items-center justify-between gap-3 ${inventoryTvScroll ? '' : 'mb-4'}`}>
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink tracking-wide">Watch Pipeline</h2>
                <p className="text-muted text-sm mt-1">
                  {buyWatches.length} buy · {sellWatches.length} sell · {watches.length} total
                  {inventoryTvScroll && <span className="text-accent font-semibold"> · TV mode</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${sseConnected ? 'text-accent border-accent/30 bg-accent/5' : 'text-muted border-default bg-panel'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-accent live-dot' : 'bg-muted'}`} />
                  {sseConnected ? 'Live' : 'Polling'}
                </div>
                {inventoryTvScroll ? (
                  <>
                    {showTasksPanel && !tasksPinned && (
                      <button type="button" onClick={toggleShowTasksPanel} title="Hide tasks panel"
                        className="hidden md:inline-flex text-[11px] font-semibold px-3 py-1.5 rounded-full border text-muted border-default bg-panel hover:text-ink">
                        Hide tasks
                      </button>
                    )}
                    {!showTasksPanel && (
                      <button type="button" onClick={toggleShowTasksPanel} title="Show tasks panel"
                        className="hidden md:inline-flex text-[11px] font-semibold px-3 py-1.5 rounded-full border text-accent border-accent/40 bg-accent/5">
                        Show tasks
                      </button>
                    )}
                    <button type="button" onClick={exitTvMode} title="Exit TV display mode"
                      className="inline-flex text-[11px] font-semibold px-4 py-1.5 rounded-full border border-ink/20 bg-ink text-card hover:opacity-90 transition-opacity">
                      Exit TV mode
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setShowCommandPalette(true)} title="Command palette (⌘K)" className="btn-ghost hidden sm:inline-flex text-xs">⌘K</button>
                    <a href="/api/watches/export" download className="btn-ghost hidden sm:inline-flex text-xs">Export</a>
                    <button onClick={() => setShowPasteMessage(true)} title="Paste WhatsApp message" className="btn-secondary text-xs sm:text-sm">
                      <span className="hidden sm:inline">Paste</span><span className="sm:hidden">📋</span>
                    </button>
                    <button type="button" onClick={toggleInventoryTvScroll} title="Auto-scroll inventory for TV display"
                      className="inline-flex text-[11px] font-semibold px-3 py-1.5 rounded-full border text-muted border-default bg-panel hover:text-ink transition-colors">
                      TV scroll
                    </button>
                    <button onClick={() => { setAddWatchStock(''); setShowAddWatch(true) }} className="btn-primary text-xs sm:text-sm">
                      <span className="text-lg leading-none">+</span>
                      <span className="hidden sm:inline">Add Watch</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {!inventoryTvScroll && pipelineStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  ['Pipeline value', formatCurrency(pipelineStats.total_pipeline_value), false],
                  ['Stale', String(pipelineStats.stale_count), pipelineStats.stale_count > 0],
                  ['Avg sell margin', pipelineStats.avg_sell_margin != null ? formatCurrency(pipelineStats.avg_sell_margin) : '—', false],
                  ['On pipeline', String(pipelineStats.total_watches), false],
                ].map(([label, value, warn]) => (
                  <div key={label as string} className="rounded-2xl bg-panel border border-default px-4 py-3">
                    <div className="section-label text-[9px]">{label as string}</div>
                    <div className={`font-display text-lg font-semibold ${warn ? 'text-accent' : 'text-ink'}`}>{value as string}</div>
                  </div>
                ))}
              </div>
            )}

            {!inventoryTvScroll && (
            <>
            <ImportInboxPanel onImported={fetchWatches} />

            {/* Stock-first quick entry */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={quickStock}
                onChange={e => setQuickStock(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && quickStock.trim()) openAddWithStock(quickStock) }}
                placeholder="Enter stock # to add…"
                className="input-field flex-1"
              />
              <button type="button" disabled={!quickStock.trim()}
                onClick={() => openAddWithStock(quickStock)}
                className="btn-primary disabled:opacity-40 px-6">
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
                    className={`${cfg.bg} rounded-2xl px-3 py-3 flex items-center gap-3 text-left transition-all ${active ? 'ring-2 ring-accent ring-offset-2 ring-offset-card' : 'hover:border-accent/30'}`}>
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
              <button type="button" onClick={() => setDeptFilter(null)} className="mt-2 text-xs text-accent font-semibold hover:underline">
                Clear department filter
              </button>
            )}
            </>
            )}
          </div>

          <AutoScrollViewport
            enabled={inventoryTvScroll}
            className=""
            innerClassName="p-4 sm:p-8 space-y-10"
            speedPxPerSec={45}
            pauseMs={2500}
          >
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
                  <button onClick={() => setShowPasteMessage(true)} className="btn-secondary">Paste message</button>
                  <button onClick={() => setShowAddWatch(true)} className="btn-primary">Add watch</button>
                </div>
              </div>
            ) : filteredWatches.length === 0 ? (
              <div className="text-center py-12 text-muted">
                <p className="font-semibold">No watches match your filters</p>
                <button type="button" onClick={() => { setFilters({ search: '', watchType: 'all', payment: 'all', location: 'all' }); setDeptFilter(null) }}
                  className="mt-2 text-sm text-accent font-semibold hover:underline">Clear all filters</button>
              </div>
            ) : (
              <>
                <section>
                  <div className="flex items-center gap-3 mb-4 px-1">
                    <h3 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-ink">Buy Inventory</h3>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border border-default bg-panel">{buyWatches.length}</span>
                  </div>
                  {buyWatches.length === 0 ? (
                    <p className="text-sm text-muted px-4 py-8 text-center rounded-3xl border border-dashed border-default bg-panel">
                      No buy watches match — paste a purchase message or add stock #
                    </p>
                  ) : (
                    <div className={inventoryGridClass}>
                      {buyWatches.map(watch => (
                        <WatchCard key={watch.id} watch={watch} compact={compactMode}
                          highlighted={focusedWatchId === watch.id}
                          searchHighlight={filters.search.trim()}
                          onCardClick={setSelectedWatch}
                          onRemoveRequest={setRemoveTarget}
                          onOpenTasks={handleOpenTasks}
                          onImageFetched={fetchWatches} />
                      ))}
                    </div>
                  )}
                </section>
                <section>
                  <div className="flex items-center gap-3 mb-4 px-1">
                    <h3 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-accent">Sell Inventory</h3>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border border-accent/30 bg-accent/5 text-accent">{sellWatches.length}</span>
                  </div>
                  {sellWatches.length === 0 ? (
                    <p className="text-sm text-muted px-4 py-8 text-center rounded-3xl border border-dashed border-default bg-panel">
                      No sell watches match — paste a sold message
                    </p>
                  ) : (
                    <div className={inventoryGridClass}>
                      {sellWatches.map(watch => (
                        <WatchCard key={watch.id} watch={watch} compact={compactMode}
                          highlighted={focusedWatchId === watch.id}
                          searchHighlight={filters.search.trim()}
                          onCardClick={setSelectedWatch}
                          onRemoveRequest={setRemoveTarget}
                          onOpenTasks={handleOpenTasks}
                          onImageFetched={fetchWatches} />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </AutoScrollViewport>
        </div>

        {/* RIGHT — Tasks sidebar (flex split, never overlaps inventory) */}
        {showTasksPanel && (
        <div className={`flex flex-col min-h-0 shrink-0 w-full md:w-[42%] md:max-w-[42%] md:flex-[0_0_42%] ${panelHeightClass} border-l border-default bg-surface overflow-hidden ${activeTab === 'tasks' || activeTab === 'sell' ? 'flex' : 'hidden'} md:flex`}>
          <div className="flex items-center justify-between px-4 py-5 border-b border-default bg-card sm:px-8 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button type="button" onClick={() => setActiveTab('inventory')}
                className="md:hidden flex-shrink-0 w-9 h-9 rounded-full bg-panel border border-default text-ink font-bold text-lg leading-none">
                ←
              </button>
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-bold text-ink tracking-wide">Watch Tasks</h2>
              {focusedWatch ? (
                <p className="text-accent text-xs mt-1 font-medium sm:text-sm truncate max-w-[240px] sm:max-w-none">
                  #{focusedWatch.stock_no || focusedWatch.id} {focusedWatch.brand} {focusedWatch.model}
                </p>
              ) : (
                <p className="text-muted text-xs mt-0.5 font-medium sm:text-sm">
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button type="button" onClick={toggleTasksPinned} title="Keep tasks panel open in split view"
                className={`hidden md:inline-flex text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${tasksPinned ? 'text-accent border-accent/40 bg-accent/5' : 'text-muted border-default bg-panel'}`}>
                {tasksPinned ? 'Pinned' : 'Pin tasks'}
              </button>
              <button type="button" onClick={toggleAutoScroll} title="Auto-scroll task list"
                className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-colors ${autoScroll ? 'text-accent border-accent/40 bg-accent/5' : 'text-muted border-default bg-panel'}`}>
                {autoScroll ? 'Task scroll on' : 'Task scroll'}
              </button>
              {!tasksPinned && (
                <button type="button" onClick={toggleShowTasksPanel} title="Hide tasks panel"
                  className="hidden md:inline-flex text-[11px] font-semibold px-3 py-1.5 rounded-full border text-muted border-default bg-panel hover:text-ink">
                  Hide
                </button>
              )}
            </div>
          </div>

          <div className="sticky top-0 z-20 flex border-b border-default bg-card/95 backdrop-blur-sm px-4 gap-2 pt-2 flex-shrink-0">
            <button onClick={() => { setTaskTab('buy'); setActiveTab('tasks') }}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${taskTab === 'buy' ? 'border-accent text-accent' : 'border-transparent text-muted'}`}>
              Buy Tasks
            </button>
            <button onClick={() => { setTaskTab('sell'); setActiveTab('sell') }}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${taskTab === 'sell' ? 'border-accent text-accent' : 'border-transparent text-muted'}`}>
              Sell Tasks
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
        )}

        {!showTasksPanel && (
          <button type="button" onClick={toggleShowTasksPanel}
            className="hidden md:flex fixed right-6 top-24 z-40 items-center gap-2 px-4 py-2.5 rounded-full border-2 border-sell bg-card text-sm font-semibold text-accent shadow-lg hover:bg-accent/5 transition-colors">
            Show tasks
          </button>
        )}
      </div>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-card/95 backdrop-blur-sm border-t border-default z-50 flex">
        {([
          ['inventory', 'Stock'],
          ['tasks', 'Buy'],
          ['sell', 'Sell'],
          ['add', 'Add'],
        ] as const).map(([tab, label]) => (
          <button key={tab} type="button"
            onClick={() => tab === 'add' ? setShowActionSheet(true) : setActiveTab(tab)}
            className={`flex-1 py-3 flex flex-col items-center text-[10px] font-semibold uppercase tracking-wider ${activeTab === tab ? 'text-accent' : 'text-muted'}`}>
            {label}
          </button>
        ))}
      </div>

      {showActionSheet && (
        <div className="fixed inset-0 bg-ink/40 z-50 md:hidden flex items-end" onClick={() => setShowActionSheet(false)}>
          <div className="bg-card w-full rounded-t-[2rem] p-6 space-y-3 border-t border-default" onClick={e => e.stopPropagation()}>
            <p className="font-display text-sm font-bold uppercase tracking-widest text-ink mb-2">Add watch</p>
            <button onClick={() => { setShowPasteMessage(true); setShowActionSheet(false) }}
              className="w-full py-3 rounded-full btn-secondary">Paste WhatsApp message</button>
            <button onClick={() => { setAddWatchStock(''); setShowAddWatch(true); setShowActionSheet(false) }}
              className="w-full py-3 rounded-full btn-primary">Full add form</button>
            <div className="flex gap-2 pt-1">
              <input type="text" value={quickStock} onChange={e => setQuickStock(e.target.value)} placeholder="Stock #"
                className="input-field flex-1" />
              <button onClick={() => openAddWithStock(quickStock)} disabled={!quickStock.trim()}
                className="btn-primary disabled:opacity-40 px-5">Go</button>
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
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-5 py-3 bg-ink text-card rounded-full text-sm">
          <span>Removed #{undoRemove.watch.stock_no || undoRemove.watch.id}</span>
          <button type="button" onClick={undoRemoveAction} className="font-semibold text-sand hover:text-white">Undo</button>
        </div>
      )}
    </div>
  )
}
