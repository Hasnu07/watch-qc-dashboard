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

export default function TaskCard({ member, tasks, onTaskAdded }: TaskCardProps) {
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    setAdding(true)
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_member_id: member.id,
          message_text: input.trim(),
        }),
      })
      setInput('')
      onTaskAdded()
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="bg-[#16161f] rounded-2xl border border-white/10 p-5 mb-4">
      {/* Member header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
          {member.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h3 className="text-white font-bold text-xl leading-tight">
            {member.name}
          </h3>
          <span className="text-slate-500 text-sm">
            {tasks.length === 0
              ? 'No tasks yet'
              : `${tasks.length} task${tasks.length !== 1 ? 's' : ''} today`}
          </span>
        </div>
      </div>

      {/* Task list */}
      {tasks.length > 0 ? (
        <ul className="mb-4 space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className="flex items-start gap-2 text-slate-200 text-base"
            >
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
              <span className="flex-1 leading-snug">{task.message_text}</span>
              {task.estimated_minutes != null ? (
                <span className="ml-2 flex-shrink-0 text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                  ~{task.estimated_minutes} min
                </span>
              ) : (
                <span className="ml-2 flex-shrink-0 text-xs bg-slate-700/50 text-slate-500 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                  estimating...
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mb-4 text-slate-600 text-sm italic">
          Waiting for WhatsApp reply...
        </div>
      )}

      {/* Manual add task */}
      <form onSubmit={handleAddTask} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a task manually..."
          className="flex-1 bg-[#0d0d15] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-slate-600 text-sm focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={adding || !input.trim()}
          className="px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-600/30 hover:border-blue-600 text-sm font-medium transition-all disabled:opacity-40"
        >
          {adding ? '...' : 'Add'}
        </button>
      </form>
    </div>
  )
}
