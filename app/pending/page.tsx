'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PendingTasksPanel, { PENDING_TEAMS, teamOf } from '@/components/PendingTasksPanel'
import PendingQueuePanel from '@/components/PendingQueuePanel'
import PendingOpsSidebar from '@/components/PendingOpsSidebar'
import { usePendingDashboard, type PendingFilter } from '@/hooks/usePendingDashboard'
import { useCurrentMember } from '@/hooks/useCurrentMember'
import type { PendingView } from '@/lib/pending-dashboard'

const EMPTY_UNASSIGNED = {
  pending_count: 0,
  overdue_count: 0,
  due_soon_count: 0,
  team_tasks: [],
  watch_groups: [],
}

const VIEW_OPTIONS: { id: PendingView; label: string }[] = [
  { id: 'people', label: 'By person' },
  { id: 'queue', label: 'Triage queue' },
]

const FILTER_OPTIONS: { id: PendingFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'due_soon', label: 'Due soon' },
]

export default function PendingPage() {
  const router = useRouter()
  const { data, loading, now, refresh } = usePendingDashboard()
  const { isMaster } = useCurrentMember()
  const [filter, setFilter] = useState<PendingFilter>('all')
  const [view, setView] = useState<PendingView>('people')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [focusUnassigned, setFocusUnassigned] = useState(false)

  // Only show teams that actually have members, so the filter doesn't list empties.
  const presentTeams = new Set((data?.members ?? []).map(m => teamOf(m.member)))
  const teamChips = PENDING_TEAMS.filter(t => presentTeams.has(t.id))

  const allMembers = data?.members ?? []
  const filteredMembers = teamFilter === 'all'
    ? allMembers
    : allMembers.filter(m => teamOf(m.member) === teamFilter)
  // Unassigned tasks belong to no team — hide them when a team is selected.
  const filteredUnassigned = teamFilter === 'all'
    ? (data?.unassigned ?? EMPTY_UNASSIGNED)
    : EMPTY_UNASSIGNED

  return (
    <div className="flex flex-col flex-1 min-h-[calc(100dvh-3rem)]">
      <div className="px-4 py-4 border-b border-default bg-panel sm:px-6 flex-shrink-0">
        <h1 className="text-lg font-semibold text-ink">Pending Tasks</h1>
        <p className="text-xs text-muted mt-0.5">
          {data?.summary
            ? `${data.summary.total_pending} pending · ${data.summary.overdue_count} overdue`
            : 'Team + watch tasks by person'}
        </p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="pending-ops-layout">
          <div className="pending-ops-main order-2 lg:order-1">
            <div className="pending-people-list p-4 sm:p-5 space-y-3 w-full">
              <div className="flex flex-wrap gap-2 mb-2">
                {isMaster && (
                <div className="pending-view-toggle flex flex-wrap gap-1.5 mr-2">
                  {VIEW_OPTIONS.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setView(opt.id)}
                      className={`pending-filter-chip ${view === opt.id ? 'pending-filter-chip-active' : ''}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                )}
                {FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setFilter(opt.id)}
                    className={`pending-filter-chip ${filter === opt.id ? 'pending-filter-chip-active' : ''}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* By-team filter */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted mr-1">Team</span>
                <button
                  type="button"
                  onClick={() => setTeamFilter('all')}
                  className={`pending-filter-chip ${teamFilter === 'all' ? 'pending-filter-chip-active' : ''}`}
                >
                  All teams
                </button>
                {teamChips.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTeamFilter(t.id)}
                    className={`pending-filter-chip ${teamFilter === t.id ? 'pending-filter-chip-active' : ''}`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-16 rounded-xl bg-panel animate-pulse" />
                  ))}
                </div>
              ) : view === 'queue' && isMaster ? (
                <PendingQueuePanel
                  members={filteredMembers}
                  unassigned={filteredUnassigned}
                  filter={filter}
                  now={now}
                  onRefresh={refresh}
                  onOpenWatch={(watchId, phase) => {
                    const tab = phase === 'SELL' ? 'sell' : 'buy'
                    router.push(`/dashboard?tab=${tab}&watch=${watchId}`)
                  }}
                />
              ) : (
                <PendingTasksPanel
                  members={filteredMembers}
                  unassigned={filteredUnassigned}
                  filter={filter}
                  hideFilters
                  focusUnassigned={focusUnassigned}
                  onFocusUnassignedHandled={() => setFocusUnassigned(false)}
                  loading={loading}
                  now={now}
                  onRefresh={refresh}
                  onOpenWatch={(watchId, phase) => {
                    const tab = phase === 'SELL' ? 'sell' : 'buy'
                    router.push(`/dashboard?tab=${tab}&watch=${watchId}`)
                  }}
                />
              )}
            </div>
          </div>

          <div className="pending-ops-aside order-1 lg:order-2">
            <PendingOpsSidebar
              summary={data?.summary ?? null}
              loading={loading}
              filter={filter}
              onFilterChange={next => {
                setFilter(next)
                if (next !== 'all') setFocusUnassigned(false)
              }}
              onFocusUnassigned={isMaster ? () => {
                setView('people')
                setFilter('all')
                setFocusUnassigned(true)
              } : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

