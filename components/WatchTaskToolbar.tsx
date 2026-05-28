'use client'

import type { WatchTaskSortMode } from '@/hooks/useWatchTaskFilters'

interface TeamMember {
  id: number
  name: string
}

interface Props {
  totalPending: number
  watchCount: number
  myTasksOnly: boolean
  onMyTasksOnlyChange: (value: boolean) => void
  myName: string
  onMyNameChange: (name: string) => void
  teamMembers: TeamMember[]
  sort: WatchTaskSortMode
  onSortChange: (sort: WatchTaskSortMode) => void
}

export default function WatchTaskToolbar({
  totalPending,
  watchCount,
  myTasksOnly,
  onMyTasksOnlyChange,
  myName,
  onMyNameChange,
  teamMembers,
  sort,
  onSortChange,
}: Props) {
  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <div className="flex-1 min-w-[120px] px-4 py-2.5 bg-card rounded-2xl border border-default">
        <span className="text-muted text-sm font-medium">
          {totalPending === 0 && !myTasksOnly
            ? 'All tasks complete'
            : `${totalPending} pending · ${watchCount} watch${watchCount !== 1 ? 'es' : ''}`}
        </span>
      </div>
      <label className="flex items-center gap-2 text-xs font-semibold text-ink bg-card border border-default rounded-full px-3 py-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={myTasksOnly}
          onChange={e => onMyTasksOnlyChange(e.target.checked)}
        />
        My tasks
      </label>
      <select
        value={myName}
        onChange={e => onMyNameChange(e.target.value)}
        disabled={!myTasksOnly}
        className="input-field py-2 text-sm w-36 disabled:opacity-50"
      >
        <option value="">Select person…</option>
        {teamMembers.map(m => (
          <option key={m.id} value={m.name}>{m.name}</option>
        ))}
      </select>
      <select
        value={sort}
        onChange={e => onSortChange(e.target.value as WatchTaskSortMode)}
        className="input-field py-2 text-sm w-auto"
      >
        <option value="new">New first</option>
        <option value="pending">Most pending</option>
        <option value="name">Name A–Z</option>
      </select>
    </div>
  )
}

export function WatchTaskEmptyFilter({ onShowAll }: { onShowAll: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted gap-3 px-6 text-center">
      <span className="text-4xl">👤</span>
      <p className="font-semibold text-lg text-ink">No tasks assigned to you</p>
      <p className="text-sm">Turn off &quot;My tasks&quot; above, or pick your name from the list.</p>
      <button type="button" onClick={onShowAll} className="mt-2 btn-primary text-sm">
        Show all tasks
      </button>
    </div>
  )
}
