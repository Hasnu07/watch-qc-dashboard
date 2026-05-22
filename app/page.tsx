'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import WatchCard from '@/components/WatchCard'
import AddWatchModal from '@/components/AddWatchModal'
import WatchDetailModal, { type WatchDetail } from '@/components/WatchDetailModal'
import TaskCard from '@/components/TaskCard'
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

interface TeamMember {
  id: number
  name: string
  whatsapp_number: string
  department: Department
}

interface Task {
  id: number
  team_member_id: number
  message_text: string
  date: string
  estimated_minutes: number | null
  created_at: string
  team_member: TeamMember
}

const DEPT_CONFIG = {
  LOGISTICS: {
    label: 'Logistics',
    icon: '📦',
    color: 'text-blue-700',
    border: 'border-blue-200',
    bg: 'bg-blue-50',
    countColor: 'text-blue-900',
    solid: 'bg-blue-600',
  },
  ACCOUNTING: {
    label: 'Accounting',
    icon: '💰',
    color: 'text-amber-700',
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    countColor: 'text-amber-900',
    solid: 'bg-amber-500',
  },
  SALES: {
    label: 'Sales',
    icon: '🤝',
    color: 'text-emerald-700',
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    countColor: 'text-emerald-900',
    solid: 'bg-emerald-600',
  },
} as const

const DEPT_ORDER: Department[] = ['LOGISTICS', 'ACCOUNTING', 'SALES']

export default function DashboardPage() {
  const [watches, setWatches] = useState<Watch[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [showAddWatch, setShowAddWatch] = useState(false)
  const [selectedWatch, setSelectedWatch] = useState<Watch | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [sseConnected, setSseConnected] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchWatches = useCallback(async () => {
    try {
      const res = await fetch('/api/watches')
      if (res.ok) setWatches(await res.json())
    } catch (err) { console.error(err) }
  }, [])

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/team-members')
      if (res.ok) setMembers(await res.json())
    } catch (err) { console.error(err) }
  }, [])

  const fetchTodayTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks?today=true')
      if (res.ok) {
        setTasks(await res.json())
        setLastUpdated(new Date())
      }
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

  const advanceStage = async (id: number, stage: WatchStage) => {
    setWatches(prev => prev.map(w => w.id === id ? { ...w, stage } : w))
    try {
      await fetch(`/api/watches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage }),
      })
    } catch { fetchWatches() }
  }

  // SSE for real-time updates
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
          if (data.type === 'new_task') {
            setTasks(prev => prev.find(t => t.id === data.task.id) ? prev : [data.task, ...prev])
            setLastUpdated(new Date())
          }
          if (data.type === 'task_updated') {
            setTasks(prev => prev.map(t => t.id === data.task.id ? { ...t, estimated_minutes: data.task.estimated_minutes } : t))
          }
          if (data.type === 'watch_sold') {
            setWatches(prev => prev.filter(w => w.id !== data.watchId))
          }
          if (data.type === 'new_watch' || data.type === 'watch_updated') {
            fetchWatches()
          }
        } catch { /* ignore pings */ }
      }

      es.onerror = () => {
        setSseConnected(false)
        es?.close()
        if (!pollRef.current) {
          pollRef.current = setInterval(() => { fetchTodayTasks(); fetchWatches() }, 10000)
        }
        setTimeout(connectSSE, 5000)
      }
    }

    connectSSE()
    return () => { es?.close(); if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchTodayTasks, fetchWatches])

  useEffect(() => {
    fetchWatches(); fetchMembers(); fetchTodayTasks()
  }, [fetchWatches, fetchMembers, fetchTodayTasks])

  const getTasksForMember = (memberId: number) =>
    tasks.filter(t => t.team_member_id === memberId)

  const getMembersByDept = (dept: Department) =>
    members.filter(m => m.department === dept)

  const [secsAgo, setSecsAgo] = useState(0)
  useEffect(() => {
    const i = setInterval(() => setSecsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000)), 1000)
    return () => clearInterval(i)
  }, [lastUpdated])

  // Watch counts per stage
  const stageCounts = {
    LOGISTICS: watches.filter(w => w.stage === 'LOGISTICS').length,
    ACCOUNTING: watches.filter(w => w.stage === 'ACCOUNTING').length,
    SALES: watches.filter(w => w.stage === 'SALES').length,
  }

  return (
    <div className="flex flex-1 h-[calc(100vh-73px)] overflow-hidden">

      {/* LEFT PANEL — Watch Inventory */}
      <div className="flex flex-col w-[60%] border-r border-slate-200 overflow-hidden">

        {/* Header with pipeline summary */}
        <div className="px-6 py-5 border-b border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Watch Inventory</h2>
              <p className="text-slate-500 text-sm mt-0.5 font-medium">{watches.length} active watches in pipeline</p>
            </div>
            <button
              onClick={() => setShowAddWatch(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all text-base shadow-sm hover:shadow-md"
            >
              <span className="text-xl leading-none font-black">+</span> Add Watch
            </button>
          </div>

          {/* Pipeline summary bar */}
          <div className="grid grid-cols-3 gap-3">
            {DEPT_ORDER.map(dept => {
              const cfg = DEPT_CONFIG[dept]
              return (
                <div key={dept} className={`rounded-2xl px-4 py-3 border-2 ${cfg.bg} ${cfg.border} flex items-center gap-3 shadow-sm`}>
                  <span className="text-2xl">{cfg.icon}</span>
                  <div>
                    <div className={`text-xs font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</div>
                    <div className={`font-black text-2xl leading-none ${cfg.countColor}`}>{stageCounts[dept]}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Watch grid */}
        <div className="flex-1 overflow-y-auto p-5 bg-indigo-50/50">
          {watches.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
              <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-200">
                <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-lg font-semibold text-slate-500">No watches in inventory</p>
              <button onClick={() => setShowAddWatch(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors shadow-sm">
                + Add your first watch
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {watches.map(watch => (
                <WatchCard
                  key={watch.id}
                  watch={watch}
                  onAdvance={advanceStage}
                  onMarkSold={markSold}
                  onCardClick={(w) => setSelectedWatch(w)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL — Team Tasks by Department */}
      <div className="flex flex-col w-[40%] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-white shadow-sm">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Team Tasks</h2>
            <p className="text-slate-500 text-sm mt-0.5 font-medium">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
              sseConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-emerald-500 live-dot' : 'bg-amber-400'}`} />
              {sseConnected ? 'Live' : 'Polling'} · {secsAgo}s
            </div>
          </div>
        </div>

        {/* Auto-scrolling task list grouped by department */}
        <AutoScrollList className="flex-1 bg-indigo-50/50" speedPxPerSec={40}>
          <div className="p-4">
            {members.length === 0 ? (
              <div className="text-center text-slate-400 py-12">
                <p className="text-lg font-semibold">No team members yet.</p>
                <a href="/settings" className="text-indigo-600 hover:underline text-sm mt-2 inline-block font-medium">
                  Add team members in Settings →
                </a>
              </div>
            ) : (
              DEPT_ORDER.map(dept => {
                const cfg = DEPT_CONFIG[dept]
                const deptMembers = getMembersByDept(dept)
                if (deptMembers.length === 0) return null
                return (
                  <div key={dept} className="mb-5">
                    {/* Department header */}
                    <div className={`flex items-center gap-2 mb-2.5 px-4 py-2.5 rounded-xl border-2 ${cfg.bg} ${cfg.border} shadow-sm`}>
                      <span className="text-lg">{cfg.icon}</span>
                      <span className={`font-black text-sm uppercase tracking-widest ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <div className="flex-1" />
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                        {deptMembers.length}
                      </span>
                    </div>

                    {/* Members in this department */}
                    {deptMembers.map(member => (
                      <TaskCard
                        key={member.id}
                        member={member}
                        tasks={getTasksForMember(member.id)}
                        onTaskAdded={fetchTodayTasks}
                      />
                    ))}
                  </div>
                )
              })
            )}
          </div>
        </AutoScrollList>
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
