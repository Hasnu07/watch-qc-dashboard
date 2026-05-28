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

const SORT_LABELS: Record<WatchTaskSortMode, string> = {
  new: 'New first',
  pending: 'Most pending',
  name: 'Name A–Z',
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
  const chipCls = (active: boolean) =>
    active ? 'chip-active' : 'chip hover:border-accent/40 hover:text-ink'

  return (
    <div className="mb-4 space-y-2.5">
      <div className="px-4 py-2.5 bg-panel rounded-2xl border border-default">
        <span className="text-sm font-medium text-ink">
          {totalPending === 0 && !myTasksOnly
            ? 'All tasks complete'
            : `${totalPending} pending · ${watchCount} watch${watchCount !== 1 ? 'es' : ''}`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onMyTasksOnlyChange(!myTasksOnly)}
          className={`${chipCls(myTasksOnly)} inline-flex items-center gap-1.5`}
        >
          <span
            className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[9px] font-bold leading-none ${
              myTasksOnly ? 'bg-white/25 border-white/40 text-white' : 'bg-card border-default text-transparent'
            }`}
            aria-hidden
          >
            ✓
          </span>
          My tasks
        </button>

        {myTasksOnly && (
          <div className="relative">
            <select
              value={myName}
              onChange={e => onMyNameChange(e.target.value)}
              className="input-field py-2 pl-4 pr-9 text-sm min-w-[9.5rem] appearance-none cursor-pointer"
            >
              <option value="">Select person…</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs" aria-hidden>
              ▾
            </span>
          </div>
        )}

        <div className="relative ml-auto sm:ml-0">
          <select
            value={sort}
            onChange={e => onSortChange(e.target.value as WatchTaskSortMode)}
            className="input-field py-2 pl-4 pr-9 text-sm min-w-[8.5rem] appearance-none cursor-pointer"
            aria-label="Sort tasks"
          >
            <option value="new">{SORT_LABELS.new}</option>
            <option value="pending">{SORT_LABELS.pending}</option>
            <option value="name">{SORT_LABELS.name}</option>
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs" aria-hidden>
            ▾
          </span>
        </div>
      </div>
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
