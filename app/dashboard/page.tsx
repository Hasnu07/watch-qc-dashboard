'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import WatchCard from '@/components/WatchCard'
import AddWatchModal from '@/components/AddWatchModal'
import PasteMessageModal from '@/components/PasteMessageModal'
import WatchDetailModal, { type WatchDetail } from '@/components/WatchDetailModal'
import WatchTaskPanel from '@/components/WatchTaskPanel'
import WatchSellTaskPanel from '@/components/WatchSellTaskPanel'
import AutoScrollList from '@/components/AutoScrollList'

type WatchStage = 'LOGISTICS' | 'ACCOUNTING' | 'SALES'
type Department = 'LOGISTICS' | 'ACCOUNTING' | 'SALES'
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
  task_summary?: TaskSummary
}

const DEPT_CONFIG = {
  LOGISTICS: { label: 'Logistics', icon: '📦', color: 'text-cyan-400', border: 'border-cyan-500/30', bg: 'bg-cyan-500/10', countColor: 'text-cyan-300', solid: 'bg-cyan-500' },
  ACCOUNTING: { label: 'Accounting', icon: '💰', color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10', countColor: 'text-amber-300', solid: 'bg-amber-500' },
  SALES: { label: 'Sales', icon: '🤝', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', countColor: 'text-emerald-300', solid: 'bg-emerald-500' },
} as const

const DEPT_ORDER: Department[] = ['LOGISTICS', 'ACCOUNTING', 'SALES']

export default function DashboardPage() {
  const [watches, setWatches] = useState<Watch[]>([])
  const [showAddWatch, setShowAddWatch] = useState(false)
  const [showPasteMessage, setShowPasteMessage] = useState(false)
  const [selectedWatch, setSelectedWatch] = useState<Watch | null>(null)
  const [sseConnected, setSseConnected] = useState(false)
  const [activeTab, setActiveTab] = useState<'inventory' | 'tasks' | 'sell'>('inventory')
  const [taskTab, setTaskTab] = useState<'buy' | 'sell'>('buy')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchWatches = useCallback(async () => {
    try {
      const res = await fetch('/api/watches')
      if (res.ok) setWatches(await res.json())
    } catch (err) { console.error(err) }
  }, [])

  const handleTaskDone = async (id: number) => {
    setWatches(prev => prev.filter(w => w.id !== id))
    try {
      await fetch(`/api/watches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_sold: true }),
      })
    } catch { fetchWatches() }
  }

  useEffect(() => {
    let es: EventSource | null = null
    const connectSSE = () => {
      es = new EventSource('/api/sse')
      es.onopen = () => {
        setSseConnected(true)
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      }
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (['new_watch', 'watch_updated', 'watch_sold', 'task_completed', 'task_updated'].includes(data.type)) fetchWatches()
        } catch { /* ignore pings */ }
      }
      es.onerror = () => {
        setSseConnected(false)
        es?.close()
        if (!pollRef.current) pollRef.current = setInterval(() => { fetchWatches() }, 10000)
        setTimeout(connectSSE, 5000)
      }
    }
    connectSSE()
    return () => { es?.close(); if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchWatches])

  useEffect(() => { fetchWatches() }, [fetchWatches])

  const stageCounts = {
    LOGISTICS: watches.filter(w => w.stage === 'LOGISTICS').length,
    ACCOUNTING: watches.filter(w => w.stage === 'ACCOUNTING').length,
    SALES: watches.filter(w => w.stage === 'SALES').length,
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* Mobile tab bar */}
      <div className="flex md:hidden border-b border-white/10 glass-strong sticky top-0 z-40">
        <button onClick={() => setActiveTab('inventory')}
          className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'inventory' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-white/40'}`}>
          ⌚ Inventory
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${activeTab === 'inventory' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white/10 text-white/30'}`}>{watches.length}</span>
        </button>
        <button onClick={() => setActiveTab('tasks')}
          className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'tasks' ? 'text-violet-400 border-b-2 border-violet-400' : 'text-white/40'}`}>
          ✅ Buy Tasks
        </button>
        <button onClick={() => setActiveTab('sell')}
          className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'sell' ? 'text-orange-400 border-b-2 border-orange-400' : 'text-white/40'}`}>
          🏷️ Sold
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Watch Inventory */}
        <div className={`flex-col w-full md:w-[58%] border-r border-white/10 overflow-hidden ${activeTab === 'inventory' ? 'flex' : 'hidden'} md:flex`}>

          <div className="px-4 py-4 border-b border-white/10 glass-strong sm:px-6 sm:py-5">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div>
                <h2 className="text-xl font-black text-gradient sm:text-2xl">Watch Inventory</h2>
                <p className="text-white/40 text-xs mt-0.5 font-medium sm:text-sm">{watches.length} active watches in pipeline</p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${sseConnected ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-emerald-500 live-dot' : 'bg-amber-400'}`} />
                  {sseConnected ? 'Live' : 'Polling'}
                </div>
                <button onClick={() => setShowPasteMessage(true)}
                  title="Paste a WhatsApp message to import"
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/70 hover:bg-emerald-500/70 border border-emerald-500/40 text-white rounded-xl font-bold transition-all text-sm shadow-[0_0_15px_rgba(52,211,153,0.2)] sm:px-4 sm:py-2.5">
                  <span className="text-base">📋</span>
                  <span className="hidden sm:inline">Paste</span>
                </button>
                <button onClick={() => setShowAddWatch(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white rounded-xl font-bold transition-all text-sm shadow-[0_0_20px_rgba(139,92,246,0.35)] sm:gap-2 sm:px-5 sm:py-2.5 sm:text-base">
                  <span className="text-lg leading-none font-black">+</span>
                  <span className="hidden sm:inline">Add Watch</span>
                  <span className="sm:hidden">Add</span>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {DEPT_ORDER.map(dept => {
                const cfg = DEPT_CONFIG[dept]
                return (
                  <div key={dept} className="glass rounded-xl px-2.5 py-2 flex items-center gap-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:gap-3">
                    <span className="text-lg sm:text-2xl">{cfg.icon}</span>
                    <div>
                      <div className={`text-[9px] font-bold uppercase tracking-widest sm:text-xs ${cfg.color}`}>{cfg.label}</div>
                      <div className="font-black text-xl leading-none text-white sm:text-2xl">{stageCounts[dept]}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-5">
            {watches.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-white/30 gap-4">
                <div className="w-20 h-20 rounded-full glass flex items-center justify-center float">
                  <svg className="w-10 h-10 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-white/40">No watches in inventory</p>
                <button onClick={() => setShowAddWatch(true)}
                  className="px-4 py-2 bg-gradient-to-r from-violet-600 to-cyan-500 text-white rounded-xl font-semibold text-sm hover:from-violet-500 hover:to-cyan-400 transition-all shadow-[0_0_20px_rgba(139,92,246,0.3)]">
                  + Add your first watch
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
                {watches.map(watch => (
                  <WatchCard key={watch.id} watch={watch} onCardClick={(w) => setSelectedWatch(w)} onTaskDone={handleTaskDone} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Watch Tasks */}
        <div className={`flex-col w-full md:w-[42%] overflow-hidden ${activeTab === 'tasks' || activeTab === 'sell' ? 'flex' : 'hidden'} md:flex`}>

          <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 glass-strong sm:px-6 sm:py-5">
            <div>
              <h2 className="text-xl font-black text-gradient-cyan sm:text-2xl">Watch Tasks</h2>
              <p className="text-white/40 text-xs mt-0.5 font-medium sm:text-sm">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${sseConnected ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border-amber-500/30'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-emerald-500 live-dot' : 'bg-amber-400'}`} />
              {sseConnected ? 'Live' : 'Polling'}
            </div>
          </div>

          <div className="flex border-b border-white/10 glass px-4 gap-1 pt-2">
            <button
              onClick={() => { setTaskTab('buy'); setActiveTab('tasks') }}
              className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors border-b-2 ${taskTab === 'buy' ? 'border-violet-400 text-violet-300' : 'border-transparent text-white/30 hover:text-white/60'}`}>
              🛒 Buy Tasks
            </button>
            <button
              onClick={() => { setTaskTab('sell'); setActiveTab('sell') }}
              className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors border-b-2 ${taskTab === 'sell' ? 'border-orange-400 text-orange-300' : 'border-transparent text-white/30 hover:text-white/60'}`}>
              🏷️ Sold Tasks
            </button>
          </div>

          {taskTab === 'buy' ? (
            <AutoScrollList className="flex-1" speedPxPerSec={40}>
              <WatchTaskPanel />
            </AutoScrollList>
          ) : (
            <AutoScrollList className="flex-1" speedPxPerSec={40}>
              <WatchSellTaskPanel />
            </AutoScrollList>
          )}
        </div>
      </div>

      {showAddWatch && (
        <AddWatchModal onClose={() => setShowAddWatch(false)} onAdded={fetchWatches} />
      )}

      {showPasteMessage && (
        <PasteMessageModal onClose={() => setShowPasteMessage(false)} onImported={fetchWatches} />
      )}

      {selectedWatch && (
        <WatchDetailModal
          watch={selectedWatch as WatchDetail}
          onClose={() => setSelectedWatch(null)}
          onUpdated={() => { fetchWatches(); setSelectedWatch(null) }}
        />
      )}
    </div>
  )
}
