'use client'

import { useState, useEffect, useCallback } from 'react'

interface TeamMember {
  id: number
  name: string
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

export default function HistoryPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  const [filters, setFilters] = useState({
    member_id: '',
    date_from: '',
    date_to: '',
    search: '',
  })

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/team-members')
      if (res.ok) setMembers(await res.json())
    } catch (err) {
      console.error(err)
    }
  }, [])

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.member_id) params.set('member_id', filters.member_id)
      if (filters.date_from) params.set('date_from', filters.date_from)
      if (filters.date_to) params.set('date_to', filters.date_to)
      if (filters.search) params.set('search', filters.search)

      const res = await fetch(`/api/tasks?${params.toString()}`)
      if (res.ok) setTasks(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const clearFilters = () => {
    setFilters({ member_id: '', date_from: '', date_to: '', search: '' })
  }

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="px-8 py-5 border-b border-slate-200 bg-white">
        <h1 className="text-3xl font-bold text-slate-900">Task History</h1>
        <p className="text-slate-400 mt-1">All tasks ever received from the team</p>
      </div>

      {/* Filters */}
      <div className="px-8 py-4 bg-white border-b border-slate-200 flex flex-wrap gap-4 items-end">
        {/* Search */}
        <div className="flex-1 min-w-48">
          <label className="text-xs text-slate-500 block mb-1">Search task</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            placeholder="Search task text..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 placeholder-slate-400 text-base focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          />
        </div>

        {/* Member filter */}
        <div className="min-w-44">
          <label className="text-xs text-slate-500 block mb-1">Team member</label>
          <select
            value={filters.member_id}
            onChange={(e) => setFilters({ ...filters, member_id: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-base focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          >
            <option value="">All members</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date from */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">From date</label>
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => setFilters({ ...filters, date_from: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-base focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          />
        </div>

        {/* Date to */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">To date</label>
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => setFilters({ ...filters, date_to: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-base focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
          />
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="px-4 py-2.5 text-slate-500 hover:text-slate-900 text-base border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 py-6 bg-slate-50">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-slate-400 text-lg">
            Loading...
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
            <p className="text-xl">No tasks found</p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-blue-600 hover:underline text-base"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full text-base">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-sm uppercase tracking-wide border-b border-slate-200">
                  <th className="text-left px-6 py-4 font-semibold">Date</th>
                  <th className="text-left px-6 py-4 font-semibold">Team Member</th>
                  <th className="text-left px-6 py-4 font-semibold">Task</th>
                  <th className="text-right px-6 py-4 font-semibold whitespace-nowrap">Est. Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((task) => (
                  <tr
                    key={task.id}
                    className="bg-white hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                      {task.date}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {task.team_member.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-slate-900 font-medium">
                          {task.team_member.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700 max-w-xl">
                      <p className="line-clamp-2">{task.message_text}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {task.estimated_minutes != null ? (
                        <span className="text-blue-600 font-medium bg-blue-50 px-3 py-1 rounded-full text-sm whitespace-nowrap border border-blue-100">
                          ~{task.estimated_minutes} min
                        </span>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-slate-50 px-6 py-3 text-slate-400 text-sm text-right border-t border-slate-100">
              {tasks.length} record{tasks.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
