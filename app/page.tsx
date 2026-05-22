'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import WatchCard from '@/components/WatchCard'
import AddWatchModal from '@/components/AddWatchModal'
import TaskCard from '@/components/TaskCard'
import AutoScrollList from '@/components/AutoScrollList'

type WatchStage = 'LOGISTICS' | 'ACCOUNTING' | 'SALES'
type Department = 'LOGISTICS' | 'ACCOUNTING' | 'SALES'

interface Watch {
  id: number
  name: string
  image_url: string | null
  website_price: string
  b2b_price: string
  stage: WatchStage
  is_sold: boolean
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
    color: 'text-blue-400',
    border: 'border-blue-500/40',
    bg: 'bg-blue-500/10',
  },
  ACCOUNTING: {
    label: 'Accounting',
    icon: '💰',
    color: 'text-amber-400',
    border: 'border-amber-500/40',
    bg: 'bg-amber-500/10',
  },
  SALES: {
    label: 'Sales',
    icon: '🤝',
    color: 'text-green-400',
    border: 'border-green-500/40',
    bg: 'bg-green-500/10',
  },
} as const

const DEPT_ORDER: Department[] = ['LOGISTICS', 'ACCOUNTING', 'SALES']

export default function DashboardPage() {
  const [watches, setWatches] = useState<Watch[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [showAddWatch, setShowAddWatch] = useState(false)
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
      <div className="flex flex-col w-[60%] border-r border-white/10 overflow-hidden">

        {/* Header with pipeline summary */}
        <div className="px-6 py-4 border-b border-white/10 bg-[#111118]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-2xl font-bold text-white">Watch Inventory</h2>
              <p className="text-slate-400 text-sm mt-0.5">{watches.length} active watches</p>
            </div>
            <button
              onClick={() => setShowAddWatch(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold transition-colors text-base"
            >
              <span className="text-xl leading-none">+</span> Add Watch
            </button>
          </div>

          {/* Pipeline summary bar */}
          <div className="grid grid-cols-3 gap-3">
            {DEPT_ORDER.map(dept => {
              const cfg = DEPT_CONFIG[dept]
              return (
                <div key={dept} className={`rounded-xl px-3 py-2 border ${cfg.bg} ${cfg.border} flex items-center gap-2`}>
                  <span className="text-lg">{cfg.icon}</span>
                  <div>
                    <div className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</div>
                    <div className="text-white font-bold text-lg leading-none">{stageCounts[dept]}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Watch grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {watches.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-4">
              <svg className="w-20 h-20 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xl">No watches in inventory</p>
              <button onClick={() => setShowAddWatch(true)} className="text-blue-400 hover:underline text-base">
                Add your first watch
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
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL — Team Tasks by Department */}
      <div className="flex flex-col w-[40%] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#111118]">
          <div>
            <h2 className="text-2xl font-bold text-white">Team Tasks</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              Today — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-green-400 live-dot' : 'bg-yellow-400'}`} />
            <span className="text-slate-400">{sseConnected ? 'Live' : 'Polling'} · {secsAgo}s ago</span>
          </div>
        </div>

        {/* Auto-scrolling task list grouped by department */}
        <AutoScrollList className="flex-1" speedPxPerSec={40}>
          <div className="p-5">
            {members.length === 0 ? (
              <div className="text-center text-slate-600 py-12">
                <p className="text-lg">No team members yet.</p>
                <a href="/settings" className="text-blue-400 hover:underline text-sm mt-2 inline-block">
                  Add team members in Settings
                </a>
              </div>
            ) : (
              DEPT_ORDER.map(dept => {
                const cfg = DEPT_CONFIG[dept]
                const deptMembers = getMembersByDept(dept)
                if (deptMembers.length === 0) return null
                return (
                  <div key={dept} className="mb-6">
                    {/* Department header */}
                    <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                      <span className="text-xl">{cfg.icon}</span>
                      <span className={`font-bold text-base uppercase tracking-wider ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <div className="flex-1" />
                      <span className="text-xs text-slate-500 font-medium">
                        {deptMembers.length} member{deptMembers.length !== 1 ? 's' : ''}
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
    </div>
  )
}
