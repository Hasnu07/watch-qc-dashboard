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
  assigned_by_id: number | null
  message_text: string
  date: string
  estimated_minutes: number | null
  is_completed: boolean
  completed_at: string | null
  reminder_interval_minutes: number | null
  created_at: string
  team_member: TeamMember
  assigned_by: TeamMember | null
}

const REMINDER_OPTIONS = [
  { value: '60', label: '60 minutes' },
  { value: '180', label: '3 hours' },
  { value: '1440', label: '24 hours' },
  { value: '', label: 'On completion only' },
]

const DEPT_COLORS: Record<Department, string> = {
  ACCOUNTING: 'bg-amber-500',
  SALES: 'bg-emerald-500',
  LOGISTICS: 'bg-blue-500',
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Avatar({ member, size = 'md', selected = false }: { member: TeamMember; size?: 'sm' | 'md'; selected?: boolean }) {
  const s = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-xs'
  return (
    <div className={`${s} rounded-full flex items-center justify-center text-white font-black flex-shrink-0 ${selected ? 'bg-white/30' : DEPT_COLORS[member.department]}`}>
      {member.name.charAt(0).toUpperCase()}
    </div>
  )
}

function PersonGrid({ members, selected, onSelect, label }: {
  members: TeamMember[]
  selected: string
  onSelect: (id: string) => void
  label: string
}) {
  return (
    <div>
      <label className="text-xs text-slate-500 block mb-2 font-semibold uppercase tracking-wide">{label}</label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {members.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(String(m.id))}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all text-left ${
              selected === String(m.id)
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
            }`}
          >
            <Avatar member={m} selected={selected === String(m.id)} />
            <span className="truncate">{m.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ReminderBadge({ minutes }: { minutes: number | null }) {
  if (!minutes) return null
  const label = minutes === 60 ? '60 min' : minutes === 180 ? '3 hrs' : minutes === 1440 ? '24 hrs' : `${minutes}m`
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
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({
    assigned_by_id: '',
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
    if (!form.assigned_by_id || !form.team_member_id || !form.message_text.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigned_by_id: form.assigned_by_id,
          team_member_id: form.team_member_id,
          message_text: form.message_text.trim(),
          reminder_interval_minutes: form.reminder_interval_minutes || null,
        }),
      })
      if (res.ok) {
        setForm({ assigned_by_id: '', team_member_id: '', message_text: '', reminder_interval_minutes: '' })
        setShowForm(false)
        fetchTasks()
      }
    } catch (err) { console.error(err) }
    finally { setSubmitting(false) }
  }

  const toggleComplete = async (task: Task) => {
    const nowDone = !task.is_completed
    setTasks(prev => prev.map(t => t.id === task.id
      ? { ...t, is_completed: nowDone, completed_at: nowDone ? new Date().toISOString() : null }
      : t
    ))
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: nowDone }),
    })
    fetchTasks()
  }

  const filtered = tasks.filter(t =>
    filter === 'all' ? true : filter === 'pending' ? !t.is_completed : t.is_completed
  )

  const pendingCount = tasks.filter(t => !t.is_completed).length
  const doneCount = tasks.filter(t => t.is_completed).length

  const canSubmit = form.assigned_by_id && form.team_member_id && form.message_text.trim() && !submitting

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto bg-indigo-50/50">
        <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-8">

          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">📌 Admin Tasks</h1>
              <p className="text-slate-500 text-sm mt-1">Assign custom tasks between team members with optional WhatsApp reminders.</p>
            </div>
            <button
              onClick={() => setShowForm(v => !v)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-sm transition-all"
            >
              <span className="text-lg leading-none">{showForm ? '×' : '+'}</span>
              {showForm ? 'Cancel' : 'Assign Task'}
            </button>
          </div>

          {showForm && (
          <section className="bg-white rounded-2xl border-2 border-slate-200 p-5 mb-6 shadow-sm">
            <h2 className="text-base font-black text-slate-900 mb-5">Assign New Task</h2>
            <form onSubmit={assignTask} className="flex flex-col gap-5">

              <PersonGrid
                members={members}
                selected={form.assigned_by_id}
                onSelect={id => setForm(f => ({ ...f, assigned_by_id: id }))}
                label="Assigned By (Who is giving the task)"
              />

              <div className="flex items-center gap-3 text-slate-400">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-lg">↓</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <PersonGrid
                members={members}
                selected={form.team_member_id}
                onSelect={id => setForm(f => ({ ...f, team_member_id: id }))}
                label="Assigned To (Who will do the task)"
              />

              <div>
                <label className="text-xs text-slate-500 block mb-2 font-semibold uppercase tracking-wide">Task Description</label>
                <textarea
                  value={form.message_text}
                  onChange={e => setForm(f => ({ ...f, message_text: e.target.value }))}
                  placeholder="Describe the task..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-2 font-semibold uppercase tracking-wide">Reminder Interval</label>
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
                disabled={!canSubmit}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-40 shadow-sm"
              >
                {submitting ? 'Assigning…' : '+ Assign Task'}
              </button>
            </form>
          </section>
          )}

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

          {loading ? (
            <div className="text-center py-12 text-slate-400 font-medium">Loading tasks…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-3">📋</div>
              <p className="font-semibold text-slate-500">No {filter !== 'all' ? filter : ''} tasks yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map(task => (
                <div key={task.id} className={`bg-white rounded-2xl border-2 shadow-sm transition-all ${task.is_completed ? 'border-emerald-200' : 'border-slate-200'}`}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">

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

                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold leading-snug mb-2 ${task.is_completed ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {task.message_text}
                        </p>

                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          {task.assigned_by && (
                            <>
                              <div className="flex items-center gap-1.5">
                                <Avatar member={task.assigned_by} size="sm" />
                                <span className="text-xs font-semibold text-slate-600">{task.assigned_by.name}</span>
                              </div>
                              <span className="text-slate-300 text-xs">→</span>
                            </>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Avatar member={task.team_member} size="sm" />
                            <span className="text-xs font-semibold text-slate-700">{task.team_member.name}</span>
                          </div>
                          <ReminderBadge minutes={task.reminder_interval_minutes} />
                          <span className="text-xs text-slate-400 ml-auto">{formatTime(task.created_at)}</span>
                        </div>

                        {task.is_completed && task.completed_at && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-2.5 py-1.5 border border-emerald-200">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="font-semibold">Completed by {task.team_member.name}</span>
                            <span className="text-emerald-500">· {formatTime(task.completed_at)}</span>
                            {task.estimated_minutes && (
                              <span className="ml-1 text-emerald-400">· ~{task.estimated_minutes} min</span>
                            )}
                          </div>
                        )}

                        {!task.is_completed && task.estimated_minutes && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Est. {task.estimated_minutes} min</span>
                          </div>
                        )}
                      </div>
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
