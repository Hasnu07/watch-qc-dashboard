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
  ACCOUNTING: 'bg-ink',
  SALES: 'bg-accent',
  LOGISTICS: 'bg-muted',
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Avatar({ member, size = 'md', selected = false }: { member: TeamMember; size?: 'sm' | 'md'; selected?: boolean }) {
  const s = size === 'sm' ? 'w-5 h-5 text-[10px]' : 'w-7 h-7 text-xs'
  return (
    <div className={`${s} rounded-full flex items-center justify-center text-white font-black flex-shrink-0 ${selected ? 'bg-white/25' : DEPT_COLORS[member.department]}`}>
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
      <label className="section-label block mb-2">{label}</label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {members.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(String(m.id))}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl border text-sm font-semibold transition-all text-left ${
              selected === String(m.id)
                ? 'chip-active'
                : 'chip hover:border-accent/40 hover:text-ink'
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
    <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-sand/50 text-ink border border-default font-semibold">
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
  const [ringing, setRinging] = useState<Record<number, 'idle' | 'sending' | 'sent' | 'error'>>({})
  const [ncOpen, setNcOpen] = useState<number | null>(null)
  const [ncReason, setNcReason] = useState('')
  const [ncStatus, setNcStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const ringTask = async (taskId: number) => {
    setRinging(prev => ({ ...prev, [taskId]: 'sending' }))
    try {
      const res = await fetch(`/api/tasks/${taskId}/ring`, { method: 'POST' })
      setRinging(prev => ({ ...prev, [taskId]: res.ok ? 'sent' : 'error' }))
      setTimeout(() => setRinging(prev => ({ ...prev, [taskId]: 'idle' })), 3000)
    } catch {
      setRinging(prev => ({ ...prev, [taskId]: 'error' }))
      setTimeout(() => setRinging(prev => ({ ...prev, [taskId]: 'idle' })), 3000)
    }
  }

  const openNcForm = (taskId: number) => {
    setNcOpen(taskId)
    setNcReason('')
    setNcStatus('idle')
  }

  const closeNcForm = () => {
    setNcOpen(null)
    setNcReason('')
    setNcStatus('idle')
  }

  const submitNotCompleted = async (taskId: number) => {
    if (!ncReason.trim()) return
    setNcStatus('sending')
    try {
      const res = await fetch(`/api/tasks/${taskId}/not-completed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: ncReason.trim() }),
      })
      if (res.ok) {
        setNcStatus('sent')
        setTimeout(() => closeNcForm(), 2000)
      } else {
        setNcStatus('error')
      }
    } catch {
      setNcStatus('error')
    }
  }

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
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-8">

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink tracking-wide">Team Tasks</h1>
              <p className="text-muted text-sm mt-1">Ad-hoc assignments — separate from watch pipeline tasks</p>
              <p className="text-muted text-sm mt-1 opacity-80">Assign custom tasks between team members with optional WhatsApp reminders.</p>
            </div>
            <button
              onClick={() => setShowForm(v => !v)}
              className="btn-primary"
            >
              <span className="text-lg leading-none">{showForm ? '×' : '+'}</span>
              {showForm ? 'Cancel' : 'Assign Task'}
            </button>
          </div>

          {showForm && (
          <section className="card p-6 mb-8">
            <h2 className="font-display text-base font-semibold text-ink mb-5 tracking-wide">Assign New Task</h2>
            <form onSubmit={assignTask} className="flex flex-col gap-5">

              <PersonGrid
                members={members}
                selected={form.assigned_by_id}
                onSelect={id => setForm(f => ({ ...f, assigned_by_id: id }))}
                label="Assigned By (Who is giving the task)"
              />

              <div className="flex items-center gap-3 text-muted">
                <div className="flex-1 h-px bg-border-strong" />
                <span className="text-lg">↓</span>
                <div className="flex-1 h-px bg-border-strong" />
              </div>

              <PersonGrid
                members={members}
                selected={form.team_member_id}
                onSelect={id => setForm(f => ({ ...f, team_member_id: id }))}
                label="Assigned To (Who will do the task)"
              />

              <div>
                <label className="section-label block mb-2">Task Description</label>
                <textarea
                  value={form.message_text}
                  onChange={e => setForm(f => ({ ...f, message_text: e.target.value }))}
                  placeholder="Describe the task..."
                  rows={3}
                  className="input-field rounded-2xl resize-none"
                />
              </div>

              <div>
                <label className="section-label block mb-2">Reminder Interval</label>
                <div className="flex flex-wrap gap-2">
                  {REMINDER_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, reminder_interval_minutes: opt.value }))}
                      className={form.reminder_interval_minutes === opt.value ? 'chip-active' : 'chip hover:border-accent/40'}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, reminder_interval_minutes: 'custom' }))}
                    className={!['60','180','1440',''].includes(form.reminder_interval_minutes) ? 'chip-active' : 'chip hover:border-accent/40'}
                  >
                    Custom
                  </button>
                </div>
                {/* Custom minutes input — shown when Custom is selected */}
                {!['60','180','1440',''].includes(form.reminder_interval_minutes) && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={10080}
                      placeholder="e.g. 90"
                      value={form.reminder_interval_minutes === 'custom' ? '' : form.reminder_interval_minutes}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '')
                        setForm(f => ({ ...f, reminder_interval_minutes: v || 'custom' }))
                      }}
                      className="w-28 input-field py-1.5"
                    />
                    <span className="text-sm text-muted font-medium">minutes</span>
                    {form.reminder_interval_minutes && form.reminder_interval_minutes !== 'custom' && (
                      <span className="text-xs text-accent font-semibold">
                        = {Number(form.reminder_interval_minutes) >= 60
                          ? `${(Number(form.reminder_interval_minutes)/60).toFixed(1).replace(/\.0$/,'')} hr${Number(form.reminder_interval_minutes) >= 120 ? 's' : ''}`
                          : `${form.reminder_interval_minutes} min`}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button type="submit" disabled={!canSubmit} className="btn-primary w-full py-3 disabled:opacity-40">
                {submitting ? 'Assigning…' : 'Assign Task'}
              </button>
            </form>
          </section>
          )}

          <div className="flex gap-2 mb-6">
            {([['all', 'All', tasks.length], ['pending', 'Pending', pendingCount], ['done', 'Done', doneCount]] as const).map(([val, label, count]) => (
              <button
                key={val}
                onClick={() => setFilter(val)}
                className={`${filter === val ? 'chip-active' : 'chip hover:border-accent/40'} flex items-center gap-1.5`}
              >
                {label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${filter === val ? 'bg-white/20 text-white' : 'bg-panel text-muted'}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted font-medium">Loading tasks…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <p className="font-semibold text-ink">No {filter !== 'all' ? filter : ''} tasks yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filtered.map(task => (
                <div key={task.id} className={`card transition-colors ${task.is_completed ? 'opacity-80' : ''}`}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">

                      <button
                        onClick={() => toggleComplete(task)}
                        className={`mt-0.5 w-6 h-6 rounded-lg border flex-shrink-0 flex items-center justify-center transition-all ${
                          task.is_completed
                            ? 'bg-accent border-accent text-white'
                            : 'border-default hover:border-accent bg-card'
                        }`}
                      >
                        {task.is_completed && (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className={`text-sm font-semibold leading-snug ${task.is_completed ? 'line-through text-muted' : 'text-ink'}`}>
                            {task.message_text}
                          </p>
                          {!task.is_completed && (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => ringTask(task.id)}
                                disabled={ringing[task.id] === 'sending'}
                                title="Ring assignee on WhatsApp"
                                className={`btn-ghost text-xs py-1 px-2.5 ${
                                  ringing[task.id] === 'sent' ? 'border-accent/40 text-accent bg-accent/5' :
                                  ringing[task.id] === 'error' ? 'text-muted' :
                                  ringing[task.id] === 'sending' ? 'animate-pulse' : ''
                                }`}
                              >
                                {ringing[task.id] === 'sent' ? <>✅ <span>Sent!</span></> :
                                 ringing[task.id] === 'error' ? <>❌ <span>Failed</span></> :
                                 ringing[task.id] === 'sending' ? <>⏳ <span>Sending</span></> :
                                 <>🔔 <span>Ring</span></>}
                              </button>
                              <button
                                onClick={() => ncOpen === task.id ? closeNcForm() : openNcForm(task.id)}
                                title="Report task not completed"
                                className={`btn-ghost text-xs py-1 px-2.5 ${ncOpen === task.id ? 'border-accent/50 text-accent' : ''}`}
                              >
                                ⚠️ <span>Not Done</span>
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          {task.assigned_by && (
                            <>
                              <div className="flex items-center gap-1.5">
                                <Avatar member={task.assigned_by} size="sm" />
                                <span className="text-xs font-semibold text-muted">{task.assigned_by.name}</span>
                              </div>
                              <span className="text-muted text-xs">→</span>
                            </>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Avatar member={task.team_member} size="sm" />
                            <span className="text-xs font-semibold text-ink">{task.team_member.name}</span>
                          </div>
                          <ReminderBadge minutes={task.reminder_interval_minutes} />
                          <span className="text-xs text-muted ml-auto">{formatTime(task.created_at)}</span>
                        </div>

                        {task.is_completed && task.completed_at && (
                          <div className="flex items-center gap-1.5 text-xs text-accent bg-accent/5 rounded-full px-3 py-1.5 border border-accent/20">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="font-semibold">Completed by {task.team_member.name}</span>
                            <span className="text-accent/70">· {formatTime(task.completed_at)}</span>
                            {task.estimated_minutes && (
                              <span className="ml-1 text-muted">· ~{task.estimated_minutes} min</span>
                            )}
                          </div>
                        )}

                        {!task.is_completed && task.estimated_minutes && (
                          <div className="flex items-center gap-1 text-xs text-muted mt-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Est. {task.estimated_minutes} min</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Not Completed inline reason form */}
                  {ncOpen === task.id && (
                    <div className="px-4 pb-4 border-t border-default bg-panel/50 rounded-b-3xl">
                      <div className="pt-4">
                        <p className="section-label mb-2">Why wasn&apos;t this task completed?</p>
                        {task.assigned_by && (
                          <p className="text-xs text-muted mb-2">
                            Your reason will be sent to <span className="font-semibold text-ink">{task.assigned_by.name}</span> via WhatsApp.
                          </p>
                        )}
                        <textarea
                          value={ncReason}
                          onChange={e => setNcReason(e.target.value)}
                          placeholder="Task not completed because..."
                          rows={3}
                          disabled={ncStatus === 'sending' || ncStatus === 'sent'}
                          className="input-field rounded-2xl resize-none disabled:opacity-50"
                        />
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => submitNotCompleted(task.id)}
                            disabled={!ncReason.trim() || ncStatus === 'sending' || ncStatus === 'sent'}
                            className={`flex-1 btn-primary text-xs disabled:opacity-40 ${ncStatus === 'sending' ? 'animate-pulse' : ''}`}
                          >
                            {ncStatus === 'sent' ? 'Sent to ' + (task.assigned_by?.name ?? 'assigner') :
                             ncStatus === 'error' ? 'Failed — try again' :
                             ncStatus === 'sending' ? 'Sending…' :
                             `Send to ${task.assigned_by?.name ?? 'assigner'}`}
                          </button>
                          <button onClick={closeNcForm} disabled={ncStatus === 'sending'} className="btn-ghost text-xs disabled:opacity-40">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
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
