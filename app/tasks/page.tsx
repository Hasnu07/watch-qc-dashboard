'use client'

import { useState } from 'react'
import WatchTaskPanel from '@/components/WatchTaskPanel'
import WatchSellTaskPanel from '@/components/WatchSellTaskPanel'
import AutoScrollList from '@/components/AutoScrollList'

export default function TasksPage() {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy')

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 sm:text-2xl">Watch Tasks</h1>
          <p className="text-slate-500 text-xs mt-0.5 font-medium sm:text-sm">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 gap-1 pt-2">
        <button
          onClick={() => setTab('buy')}
          className={`px-5 py-2.5 text-sm font-bold rounded-t-lg transition-colors border-b-2 ${
            tab === 'buy'
              ? 'border-indigo-500 text-indigo-700 bg-indigo-50/60'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          ✅ Buy Tasks
        </button>
        <button
          onClick={() => setTab('sell')}
          className={`px-5 py-2.5 text-sm font-bold rounded-t-lg transition-colors border-b-2 ${
            tab === 'sell'
              ? 'border-orange-500 text-orange-700 bg-orange-50/60'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          🏷️ Sold Tasks
        </button>
      </div>

      {/* Panel */}
      {tab === 'buy' ? (
        <AutoScrollList className="flex-1 overflow-y-auto bg-indigo-50/30" speedPxPerSec={40}>
          <WatchTaskPanel />
        </AutoScrollList>
      ) : (
        <AutoScrollList className="flex-1 overflow-y-auto bg-orange-50/20" speedPxPerSec={40}>
          <WatchSellTaskPanel />
        </AutoScrollList>
      )}
    </div>
  )
}
