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
import DashboardToolsMenu from '@/components/DashboardToolsMenu'
import CommandPalette from '@/components/CommandPalette'
import SkeletonCard from '@/components/SkeletonCard'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { DEPT_ORDER, type Department } from '@/lib/ui-constants'

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
  linked_buy_image_url?: string | null
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
  const [compactMode, setCompactMode] = useState(true)
  const [filters, setFilters] = useState<InventoryFilters>({
    search: '', watchType: 'all', payment: 'all', location: 'all',
  })
  const [quickStock, setQuickStock] = useState('')
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [undoRemove, setUndoRemove] = useState<{ id: number; watch: Watch; timer: ReturnType<typeof setTimeout> } | null>(null)
  const [bulkFetchMsg, setBulkFetchMsg] = useState('')
  const [bulkFetching, setBulkFetching] = useState(false)

  const missingImageCount = useMemo(
    () => watches.filter(w => !w.image_url).length,
    [watches],
  )

  async function startBulkImageFetch() {
    setBulkFetching(true)
    setBulkFetchMsg('')
    try {
      const res = await fetch('/api/watches/bulk-fetch-images', { method: 'POST' })
      const data = await res.json()
      if (data.started) {
        setBulkFetchMsg(`Fetching images for ${data.queued} watches in background…`)
        const poll = setInterval(async () => {
          const st = await fetch('/api/watches/bulk-fetch-images').then(r => r.json())
          if (!st.running) {
            clearInterval(poll)
            setBulkFetchMsg(`Done — ${st.done} fetched, ${st.failed} skipped`)
            setBulkFetching(false)
            fetchWatches()
          }
        }, 4000)
      } else {
        setBulkFetchMsg(data.message || 'Nothing to fetch')
        setBulkFetching(false)
      }
    } catch {
      setBulkFetchMsg('Bulk fetch failed')
      setBulkFetching(false)
    }
  }

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
    setCompactMode(localStorage.getItem('qc-compact-cards') !== '0')
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

  const toggleInventoryTvScroll = () => {
    const next = !inventoryTvScroll
    setInventoryTvScroll(next)
    localStorage.setItem('qc-inventory-tv-scroll', next ? '1' : '0')
  }

  const exitTvMode = () => {
    setInventoryTvScroll(false)
    localStorage.setItem('qc-inventory-tv-scroll', '0')
    if (tasksPinned) {
      setShowTasksPanel(true)
      localStorage.setItem('qc-show-tasks', '1')
    }
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
    const next = !showTasksPanel
    setShowTasksPanel(next)
    localStorage.setItem('qc-show-tasks', next ? '1' : '0')
  }

  const toggleCompact = (v: boolean) => {
    setCompactMode(v)
    localStorage.setItem('qc-compact-cards', v ? '1' : '0')
  }

  const usePageScrollLayout = !inventoryTvScroll
  const useStickyTasks = showTasksPanel && tasksPinned && usePageScrollLayout
  const taskPanelLocked = useStickyTasks || (!usePageScrollLayout && showTasksPanel)

  const TaskListWrapper = ({ children }: { children: React.ReactNode }) =>
    autoScroll ? (
      <AutoScrollList className="flex-1 min-h-0" speedPxPerSec={50} enabled={autoScroll}>{children}</AutoScrollList>
    ) : taskPanelLocked ? (
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    ) : (
      <div>{children}</div>
    )

  const viewportHeightClass = 'h-[calc(100dvh-3rem)] max-h-[calc(100dvh-3rem)]'
  const splitRowClass = usePageScrollLayout
    ? 'flex w-full'
    : 'flex flex-1 overflow-hidden min-h-0 h-full w-full'
  const pinnedTasksClass = 'md:fixed md:top-12 md:right-0 md:w-[42%] md:max-w-[42%] md:z-30'
  const inventoryContentClass = 'w-full'
  const inventoryCardGridClass =
    'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full'
  const inventoryListBuyClass = compactMode
    ? 'inventory-list-buy rounded-xl border overflow-hidden bg-card divide-y divide-default w-full'
    : inventoryCardGridClass
  const inventoryListSellClass = compactMode
    ? 'inventory-list-sell rounded-xl border overflow-hidden bg-card divide-y divide-default w-full'
    : inventoryCardGridClass
  const leftWidthClass = showTasksPanel
    ? 'w-full md:w-[58%] md:max-w-[58%] md:flex-[0_0_58%] shrink-0'
    : 'w-full flex-1 min-w-0'
  const panelHeightClass = !usePageScrollLayout && (showTasksPanel || inventoryTvScroll)
    ? viewportHeightClass
    : 'h-full max-h-full'

  const renderInventoryBody = () => (
    loading ? (
      <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${compactMode ? 'w-full' : inventoryListBuyClass}`}>
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
        <section className="inventory-section mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-buy-title text-lg font-bold">Buy</h3>
            <span className="text-xs text-muted font-medium">{buyWatches.length} watches</span>
          </div>
          {buyWatches.length === 0 ? (
            <p className="text-sm text-muted px-4 py-8 text-center rounded-3xl border border-dashed border-buy bg-panel/60">
              No buy watches match — paste a purchase message or add stock #
            </p>
          ) : (
            <div className={inventoryListBuyClass}>
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
        <section className="inventory-section">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sell-title text-lg font-bold">Sell</h3>
            <span className="text-xs text-muted font-medium">{sellWatches.length} watches</span>
          </div>
          {sellWatches.length === 0 ? (
            <p className="text-sm text-muted px-4 py-8 text-center rounded-3xl border border-dashed border-sell bg-panel/60">
              No sell watches match — paste a sold message
            </p>
          ) : (
            <div className={inventoryListSellClass}>
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
    )
  )

  return (
    <div className={`flex flex-col pb-14 md:pb-0 ${usePageScrollLayout ? '' : 'flex-1 overflow-hidden'}`}>

      {/* Mobile top tabs */}
      <div className="flex md:hidden border-b border-default bg-card sticky top-0 z-40">
        {([
          ['inventory', 'Inventory', watches.length],
          ['tasks', 'Buy Tasks', null],
          ['sell', 'Sell Tasks', null],
        ] as const).map(([tab, label, count]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3.5 text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === tab
                ? tab === 'tasks' || tab === 'sell'
                  ? 'text-white bg-accent border-b-2 border-accent'
                  : 'text-accent border-b-2 border-accent'
                : tab === 'tasks' || tab === 'sell'
                  ? 'text-ink bg-panel/80'
                  : 'text-muted'
            }`}>
            {label}
            {count != null && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === tab ? 'bg-accent/10 text-accent' : 'bg-panel text-muted'}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      <div className={splitRowClass}>
        {/* LEFT — Inventory */}
        <div className={`flex flex-col ${leftWidthClass} ${usePageScrollLayout ? '' : `${panelHeightClass} min-h-0 overflow-hidden`} border-r border-default ${activeTab === 'inventory' ? 'flex' : 'hidden'} md:flex`}>
          <div className={`px-4 border-b border-default bg-panel sm:px-6 flex-shrink-0 ${inventoryTvScroll ? 'py-3' : 'py-4'}`}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-ink">Inventory</h2>
                <p className="text-xs text-muted mt-0.5">
                  {buyWatches.length} buy · {sellWatches.length} sell
                  {pipelineStats && pipelineStats.stale_count > 0 && (
                    <span className="text-negative"> · {pipelineStats.stale_count} need attention</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {inventoryTvScroll ? (
                  <button type="button" onClick={exitTvMode} className="btn-secondary text-xs">Exit TV</button>
                ) : (
                  <>
                    <button onClick={() => { setAddWatchStock(''); setShowAddWatch(true) }} className="btn-primary text-sm">
                      + Add
                    </button>
                    <DashboardToolsMenu
                      onCommandPalette={() => setShowCommandPalette(true)}
                      onPaste={() => setShowPasteMessage(true)}
                      onTvScroll={toggleInventoryTvScroll}
                      onBulkFetch={startBulkImageFetch}
                      bulkFetching={bulkFetching}
                      missingImageCount={missingImageCount}
                      inventoryTvScroll={inventoryTvScroll}
                    />
                  </>
                )}
              </div>
            </div>

            {!inventoryTvScroll && (
            <>
            <ImportInboxPanel onImported={fetchWatches} />

            {bulkFetchMsg && (
              <p className="text-xs text-muted mb-3">{bulkFetchMsg}</p>
            )}

            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={quickStock}
                onChange={e => setQuickStock(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && quickStock.trim()) openAddWithStock(quickStock) }}
                placeholder="Quick add by stock #"
                className="input-field flex-1"
              />
              <button type="button" disabled={!quickStock.trim()}
                onClick={() => openAddWithStock(quickStock)}
                className="btn-secondary disabled:opacity-40 px-4">
                Add
              </button>
            </div>

            <InventoryToolbar
              filters={filters}
              onChange={setFilters}
              compactMode={compactMode}
              onCompactModeChange={toggleCompact}
            />

            {deptFilter && (
              <button type="button" onClick={() => setDeptFilter(null)} className="mt-2 text-xs text-accent hover:underline">
                Clear department filter
              </button>
            )}
            </>
            )}
          </div>

          {inventoryTvScroll ? (
          <AutoScrollViewport
            enabled={inventoryTvScroll}
            className=""
            innerClassName="p-4 sm:p-6"
            speedPxPerSec={45}
            pauseMs={2500}
          >
            <div className={`${inventoryContentClass} space-y-8`}>
              {renderInventoryBody()}
            </div>
          </AutoScrollViewport>
          ) : (
            <div className="p-4 sm:p-6">
              <div className={`${inventoryContentClass} space-y-8`}>
                {renderInventoryBody()}
              </div>
            </div>
          )}
        </div>

        {/* Spacer keeps left column at 58% while tasks panel is fixed on the right */}
        {useStickyTasks && showTasksPanel && (
          <div className="hidden md:block shrink-0 w-[42%] max-w-[42%] flex-[0_0_42%]" aria-hidden="true" />
        )}

        {/* RIGHT — Tasks sidebar */}
        {showTasksPanel && (
        <div className={`flex flex-col shrink-0 w-full md:w-[42%] md:max-w-[42%] md:flex-[0_0_42%] border-l border-default bg-surface ${useStickyTasks ? `${viewportHeightClass} overflow-hidden ${pinnedTasksClass}` : usePageScrollLayout ? '' : `${viewportHeightClass} min-h-0 overflow-hidden`} ${activeTab === 'tasks' || activeTab === 'sell' ? 'flex' : 'hidden'} md:flex`}>
          <div className="flex items-center justify-between px-4 py-4 border-b border-default bg-panel sm:px-6 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button type="button" onClick={() => setActiveTab('inventory')}
                className="md:hidden flex-shrink-0 w-8 h-8 rounded-lg bg-card border border-default text-ink text-sm">
                ←
              </button>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-ink">Tasks</h2>
              {focusedWatch ? (
                <p className="text-xs mt-0.5 text-muted truncate max-w-[240px] sm:max-w-none">
                  #{focusedWatch.stock_no || focusedWatch.id} {focusedWatch.brand} {focusedWatch.model}
                </p>
              ) : (
                <p className="text-xs mt-0.5 text-muted">
                  {taskTab === 'sell' ? 'Sell workflow' : 'Buy workflow'}
                </p>
              )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button type="button" onClick={toggleTasksPinned} title="Pin tasks while scrolling"
                className={`hidden md:inline-flex btn-ghost text-xs ${tasksPinned ? 'text-accent' : ''}`}>
                {tasksPinned ? 'Pinned' : 'Pin'}
              </button>
              <button type="button" onClick={toggleShowTasksPanel} title="Hide tasks panel"
                className="hidden md:inline-flex btn-ghost text-xs">
                Hide
              </button>
            </div>
          </div>

          <div className={`flex border-b border-default bg-panel px-4 gap-1 flex-shrink-0 ${taskPanelLocked ? 'sticky top-0 z-20' : ''}`}>
            <button onClick={() => { setTaskTab('buy'); setActiveTab('tasks') }}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${taskTab === 'buy' ? 'border-accent text-ink' : 'border-transparent text-muted'}`}>
              Buy
            </button>
            <button onClick={() => { setTaskTab('sell'); setActiveTab('sell') }}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${taskTab === 'sell' ? 'border-accent text-ink' : 'border-transparent text-muted'}`}>
              Sell
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

        {!showTasksPanel && !inventoryTvScroll && (
          <button type="button" onClick={toggleShowTasksPanel}
            className="btn-tasks hidden md:inline-flex fixed right-6 top-20 z-40 px-6 py-3 text-base shadow-2xl">
            Show tasks
          </button>
        )}
      </div>

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-panel border-t border-default z-50 flex">
        {([
          ['inventory', 'Stock', false],
          ['tasks', 'Buy tasks', true],
          ['sell', 'Sell tasks', true],
          ['add', 'Add', false],
        ] as const).map(([tab, label, isTaskTab]) => (
          <button key={tab} type="button"
            onClick={() => tab === 'add' ? setShowActionSheet(true) : setActiveTab(tab)}
            className={`flex-1 py-4 flex flex-col items-center justify-center text-xs font-bold ${
              activeTab === tab
                ? isTaskTab
                  ? 'text-white bg-accent'
                  : 'text-accent bg-card'
                : isTaskTab
                  ? 'text-ink bg-card/60'
                  : 'text-muted'
            }`}>
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
