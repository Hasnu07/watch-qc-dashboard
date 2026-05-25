'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import WatchCard from '@/components/WatchCard'
import AddWatchModal from '@/components/AddWatchModal'
import WatchDetailModal, { type WatchDetail } from '@/components/WatchDetailModal'
import WatchTaskPanel from '@/components/WatchTaskPanel'
import WatchSellTaskPanel from '@/components/WatchSellTaskPanel'
import AutoScrollList from '@/components/AutoScrollList'

type WatchStage = 'LOGISTICS' | 'ACCOUNTING' | 'SALES'
type Department = 'LOGISTICS' | 'ACCOUNTING' | 'SALES'
type PaymentStatus = 'NOT_PAID' | 'PARTIAL' | 'PAID'
type LocationStatus = 'INCOMING' | 'IN_TRANSIT' | 'IN_STOCK'

interface Watch {
  id: number
  name: string
  brand: string | null
  model: string | null
  ref_no: string | null
  serial_no: string | null
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
}

const DEPT_CONFIG = {
  LOGISTICS: { label: 'Logistics', icon: '📦', color: 'text-blue-700', border: 'border-blue-200', bg: 'bg-blue-50', countColor: 'text-blue-900', solid: 'bg-blue-600' },
  ACCOUNTING: { label: 'Accounting', icon: '💰', color: 'text-amber-700', border: 'border-amber-200', bg: 'bg-amber-50', countColor: 'text-amber-900', solid: 'bg-amber-500' },
  SALES: { label: 'Sales', icon: '🤝', color: 'text-emerald-700', border: 'border-emerald-200', bg: 'bg-emerald-50', countColor: 'text-emerald-900', solid: 'bg-emerald-600' },
} as const

const DEPT_ORDER: Department[] = ['LOGISTICS', 'ACCOUNTING', 'SALES']

export default function DashboardPage() {
  const [watches, setWatches] = useState<Watch[]>([])
  const [showAddWatch, setShowAddWatch] = useState(false)
  const [selectedWatch, setSelectedWatch] = useState<Watch | null>(null)
  const [sseConnected, setSseConnected] = useState(false)
  const [activeTab, setActiveTab] = useState<'inventory' | 'tasks' | 'sell'>('inventory')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchWatches = useCallback(async () => {
    try {
      const res = await fetch('/api/watches')
      if (res.ok) setWatches(await res.json())
    } catch (err) { console.error(err) }
  }, [])

  const markSold = async (id: number) => {
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
          if (data.type === 'watch_sold') setWatches(prev => prev.filter(w => w.id !== data.watchId))
          if (data.type === 'new_watch' || data.type === 'watch_updated') fetchWatches()
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

      {/* Mobile tab bar — hidden on desktop */}
      <div className="flex md:hidden border-b border-slate-200 bg-white sticky top-0 z-40 shadow-sm">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'inventory'
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
              : 'text-slate-500'
          }`}
        >
          ⌚ Inventory
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${activeTab === 'inventory' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
            {watches.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'tasks'
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
              : 'text-slate-500'
          }`}
        >
          ✅ Tasks
        </button>
        <button
          onClick={() => setActiveTab('sell')}
          className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'sell'
              ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/50'
              : 'text-slate-500'
          }`}
        >
          🏷️ Sold
        </button>
      </div>

      {/* Main content — side-by-side on desktop, tabbed on mobile */}
      <div className="flex flex-1 overflow-hidden md:flex-row">

        {/* LEFT PANEL — Watch Inventory */}
        <div className={`flex-col w-full md:w-[60%] border-r border-slate-200 overflow-hidden ${activeTab === 'inventory' ? 'flex' : 'hidden'} md:flex`}>

          {/* Header */}
          <div className="px-4 py-4 border-b border-slate-200 bg-white shadow-sm sm:px-6 sm:py-5">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 sm:text-2xl">Watch Inventory</h2>
                <p className="text-slate-500 text-xs mt-0.5 font-medium sm:text-sm">{watches.length} active watches in pipeline</p>
              </div>
              <button
                onClick={() => setShowAddWatch(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all text-sm shadow-sm hover:shadow-md sm:gap-2 sm:px-5 sm:py-2.5 sm:text-base"
              >
                <span className="text-lg leading-none font-black">+</span>
                <span className="hidden sm:inline">Add Watch</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>

            {/* Pipeline summary */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {DEPT_ORDER.map(dept => {
                const cfg = DEPT_CONFIG[dept]
                return (
                  <div key={dept} className={`rounded-xl px-2.5 py-2 border-2 ${cfg.bg} ${cfg.border} flex items-center gap-2 shadow-sm sm:rounded-2xl sm:px-4 sm:py-3 sm:gap-3`}>
                    <span className="text-lg sm:text-2xl">{cfg.icon}</span>
                    <div>
                      <div className={`text-[9px] font-bold uppercase tracking-wider ${cfg.color} sm:text-xs`}>{cfg.label}</div>
                      <div className={`font-black text-xl leading-none ${cfg.countColor} sm:text-2xl`}>{stageCounts[dept]}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Watch grid */}
          <div className="flex-1 overflow-y-auto p-3 bg-indigo-50/50 sm:p-5">
            {watches.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-200 sm:w-24 sm:h-24">
                  <svg className="w-10 h-10 text-slate-300 sm:w-12 sm:h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-slate-500 sm:text-lg">No watches in inventory</p>
                <button onClick={() => setShowAddWatch(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm">
                  + Add your first watch
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
                {watches.map(watch => (
                  <WatchCard
                    key={watch.id}
                    watch={watch}
                    onMarkSold={markSold}
                    onCardClick={(w) => setSelectedWatch(w)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL — Team Tasks (Buy + Sell) */}
        <div className={`flex-col w-full md:w-[40%] overflow-hidden ${activeTab === 'tasks' || activeTab === 'sell' ? 'flex' : 'hidden'} md:flex`}>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200 bg-white shadow-sm sm:px-6 sm:py-5">
            <div>
              <h2 className="text-xl font-black text-slate-900 sm:text-2xl">Team Tasks</h2>
              <p className="text-slate-500 text-xs mt-0.5 font-medium sm:text-sm">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border sm:px-3 sm:py-1.5 ${
              sseConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-emerald-500 live-dot' : 'bg-amber-400'}`} />
              {sseConnected ? 'Live' : 'Polling'}
            </div>
          </div>

          {/* Desktop sub-tab toggle */}
          <div className="hidden md:flex border-b border-slate-200 bg-white px-4 gap-1 pt-2">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors border-b-2 ${activeTab !== 'sell' ? 'border-indigo-500 text-indigo-700 bg-indigo-50/60' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              ✅ Buy Tasks
            </button>
            <button
              onClick={() => setActiveTab('sell')}
              className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors border-b-2 ${activeTab === 'sell' ? 'border-orange-500 text-orange-700 bg-orange-50/60' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
              🏷️ Sold
            </button>
          </div>

          {/* Task panels */}
          {activeTab !== 'sell' ? (
            <AutoScrollList className="flex-1 bg-indigo-50/50" speedPxPerSec={40}>
              <WatchTaskPanel />
            </AutoScrollList>
          ) : (
            <AutoScrollList className="flex-1 bg-orange-50/30" speedPxPerSec={40}>
              <WatchSellTaskPanel />
            </AutoScrollList>
          )}
        </div>
      </div>

      {showAddWatch && (
        <AddWatchModal onClose={() => setShowAddWatch(false)} onAdded={fetchWatches} />
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
