'use client'

import { useState } from 'react'

interface Task {
  id: number
  message_text: string
  estimated_minutes: number | null
  created_at: string
}

interface TeamMember {
  id: number
  name: string
}

interface TaskCardProps {
  member: TeamMember
  tasks: Task[]
  onTaskAdded: () => void
}

const AVATAR_COLORS = [
  'from-blue-500 to-indigo-600',
  'from-violet-500 to-purple-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-emerald-500 to-teal-600',
  'from-cyan-500 to-sky-600',
]

export default function TaskCard({ member, tasks, onTaskAdded }: TaskCardProps) {
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)

  const gradient = AVATAR_COLORS[member.id % AVATAR_COLORS.length]

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setAdding(true)
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_member_id: member.id, message_text: input.trim() }),
      })
      setInput('')
      onTaskAdded()
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-4 overflow-hidden">
      {/* Member header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-base flex-shrink-0 shadow-sm`}>
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-slate-900 font-bold text-lg leading-tight truncate">{member.name}</h3>
          <span className={`text-xs font-semibold ${tasks.length > 0 ? 'text-indigo-600' : 'text-slate-400'}`}>
            {tasks.length === 0 ? 'No tasks yet' : `${tasks.length} task${tasks.length !== 1 ? 's' : ''} today`}
          </span>
        </div>
      </div>

      <div className="px-4 py-3">
        {/* Task list */}
        {tasks.length > 0 ? (
          <ul className="mb-3 space-y-2">
            {tasks.map((task, idx) => (
              <li key={task.id} className="flex items-start gap-2.5">
                <span className="mt-1.5 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-black flex-shrink-0">
                  {idx + 1}
                </span>
                <span className="flex-1 text-slate-700 text-sm leading-snug">{task.message_text}</span>
                {task.estimated_minutes != null ? (
                  <span className="ml-1 flex-shrink-0 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold whitespace-nowrap shadow-sm">
                    ~{task.estimated_minutes}m
                  </span>
                ) : (
                  <span className="ml-1 flex-shrink-0 text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                    estimating…
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="mb-3 flex items-center gap-2 text-slate-400 text-sm py-1">
            <span className="text-base">💬</span>
            <span className="italic">Waiting for WhatsApp reply…</span>
          </div>
        )}

        {/* Manual add task */}
        <form onSubmit={handleAddTask} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Add task manually…"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
          <button
            type="submit"
            disabled={adding || !input.trim()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold transition-all disabled:opacity-40 shadow-sm"
          >
            {adding ? '…' : 'Add'}
          </button>
        </form>
      </div>
    </div>
  )
}
