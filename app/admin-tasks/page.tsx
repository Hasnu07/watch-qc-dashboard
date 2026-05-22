'use client'

import { useState, useEffect, useCallback } from 'react'

type Department = 'ACCOUNTING' | 'SALES' | 'LOGISTICS'

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
  is_completed: boolean
  completed_at: string | null
  reminder_interval_minutes: number | null
  created_at: string
  team_member: TeamMember
}

const REMINDER_OPTIONS = [
  { value: '', label: 'No reminder' },
  { value: '30', label: 'Every 30 minutes' },
  { value: '60', label: 'Every 1 hour' },
  { value: '120', label: 'Every 2 hours' },
  { value: '240', label: 'Every 4 hours' },
  { value: '1440', label: 'Once daily' },
]

const DEPT_COLORS: Record<Department, string> = {
  ACCOUNTING: 'bg-amber-500',
  SALES: 'bg-emerald-500',
  LOGISTICS: 'bg-blue-500',
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function ReminderBadge({ minutes }: { minutes: number | null }) {
  if (!minutes) return null
  const label = minutes === 30 ? '30 min' : minutes === 60 ? '1 hr' : minutes === 120 ? '2 hrs' : minutes === 240 ? '4 hrs' : minutes === 1440 ? 'Daily' : `${minutes}m`
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-semibold">
      ⏰ {label}
    </span>
  )
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const [form, setForm] = useState({
    team_member_id: '',
    message_text: '',
    reminder_interval_minutes: '',
  })

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks')
      if (res.ok) setTasks(await res.json())
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }, [])

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/team-members')
      if (res.ok) setMembers(await res.json())
    } catch (err) { console.error(err) }
  }, [])

  useEffect(() => { fetchTasks(); fetchMembers() }, [fetchTasks, fetchMembers])

  const assignTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.team_member_id || !form.message_text.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_member_id: form.team_member_id,
          message_text: form.message_text.trim(),
          reminder_interval_minutes: form.reminder_interval_minutes || null,
        }),
      })
      if (res.ok) {
        setForm({ team_member_id: '', message_text: '', reminder_interval_minutes: '' })
        fetchTasks()
      }
    } catch (err) { console.error(err) }
    finally { setSubmitting(false) }
  }

  const toggleComplete = async (task: Task) => {
    const optimistic = tasks.map(t => t.id === task.id ? { ...t, is_completed: !t.is_completed, completed_at: !t.is_completed ? new Date().toISOString() : null } : t)
    setTasks(optimistic)
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: !task.is_completed }),
    })
    fetchTasks()
  }

  const deleteTask = async (id: number) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    setDeleteConfirm(null)
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  }

  const filtered = tasks.filter(t =>
    filter === 'all' ? true : filter === 'pending' ? !t.is_completed : t.is_completed
  )

  const pendingCount = tasks.filter(t => !t.is_completed).length
  const doneCount = tasks.filter(t => t.is_completed).length

  const inputClass = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-colors'

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto bg-indigo-50/50">
        <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-8">

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">📌 Admin Tasks</h1>
            <p className="text-slate-500 text-sm mt-1">Assign custom tasks to team members with optional reminders.</p>
          </div>

          {/* Assign Task Form */}
          <section className="bg-white rounded-2xl border-2 border-slate-200 p-5 mb-6 shadow-sm">
            <h2 className="text-base font-black text-slate-900 mb-4">Assign New Task</h2>
            <form onSubmit={assignTask} className="flex flex-col gap-3">

              {/* Person selector */}
              <div>
                <label className="text-xs text-slate-500 block mb-1.5 font-semibold uppercase tracking-wide">Select Person</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {members.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, team_member_id: String(m.id) }))}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all text-left ${
                        form.team_member_id === String(m.id)
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 ${
                        form.team_member_id === String(m.id) ? 'bg-white/20' : DEPT_COLORS[m.department]
                      }`}>
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate">{m.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Task description */}
              <div>
                <label className="text-xs text-slate-500 block mb-1.5 font-semibold uppercase tracking-wide">Task Description</label>
                <textarea
                  value={form.message_text}
                  onChange={e => setForm(f => ({ ...f, message_text: e.target.value }))}
                  placeholder="Describe the task..."
                  rows={3}
                  className={inputClass + ' resize-none'}
                  required
                />
              </div>

              {/* Reminder interval */}
              <div>
                <label className="text-xs text-slate-500 block mb-1.5 font-semibold uppercase tracking-wide">Reminder Interval</label>
                <div className="flex flex-wrap gap-2">
                  {REMINDER_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, reminder_interval_minutes: opt.value }))}
                      className={`px-3 py-1.5 rounded-xl border text-sm font-semibold transition-all ${
                        form.reminder_interval_minutes === opt.value
                          ? 'bg-violet-600 border-violet-600 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-violet-300 hover:bg-violet-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !form.team_member_id || !form.message_text.trim()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-40 shadow-sm mt-1"
              >
                {submitting ? 'Assigning…' : '+ Assign Task'}
              </button>
            </form>
          </section>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-4">
            {([['all', 'All', tasks.length], ['pending', 'Pending', pendingCount], ['done', 'Done', doneCount]] as const).map(([val, label, count]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all flex items-center gap-1.5 ${
                  filter === val
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                }`}
              >
                {label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${filter === val ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          {/* Task list */}
          {loading ? (
            <div className="text-center py-12 text-slate-400 font-medium">Loading tasks…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-3">📋</div>
              <p className="font-semibold text-slate-500">No {filter !== 'all' ? filter : ''} tasks</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map(task => (
                <div
                  key={task.id}
                  className={`bg-white rounded-2xl border-2 shadow-sm transition-all ${
                    task.is_completed ? 'border-emerald-200 opacity-80' : 'border-slate-200'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        onClick={() => toggleComplete(task)}
                        className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                          task.is_completed
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-slate-300 hover:border-emerald-400 bg-white'
                        }`}
                      >
                        {task.is_completed && (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold leading-snug ${task.is_completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {task.message_text}
                        </p>

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {/* Assignee */}
                          <div className="flex items-center gap-1.5">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-black ${DEPT_COLORS[task.team_member.department]}`}>
                              {task.team_member.name.charAt(0)}
                            </div>
                            <span className="text-xs font-semibold text-slate-700">{task.team_member.name}</span>
                          </div>

                          <ReminderBadge minutes={task.reminder_interval_minutes} />

                          <span className="text-xs text-slate-400 ml-auto">{formatTime(task.created_at)}</span>
                        </div>

                        {/* Execution / completion info */}
                        {task.is_completed && task.completed_at && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5 border border-emerald-200">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="font-semibold">Completed by {task.team_member.name}</span>
                            <span className="text-emerald-500">· {formatTime(task.completed_at)}</span>
                          </div>
                        )}
                      </div>

                      {/* Delete */}
                      {deleteConfirm === task.id ? (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => deleteTask(task.id)}
                            className="px-2.5 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors">
                            Delete
                          </button>
                          <button onClick={() => setDeleteConfirm(null)}
                            className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(task.id)}
                          className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 p-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="h-8" />
        </div>
      </div>
    </div>
  )
}
