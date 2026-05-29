'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import PendingTasksPanel from '@/components/PendingTasksPanel'
import PendingOpsSidebar from '@/components/PendingOpsSidebar'
import { usePendingDashboard, type PendingFilter } from '@/hooks/usePendingDashboard'

const EMPTY_UNASSIGNED = {
  pending_count: 0,
  overdue_count: 0,
  due_soon_count: 0,
  team_tasks: [],
  watch_groups: [],
}

export default function PendingPage() {
  const router = useRouter()
  const { data, loading, now, refresh } = usePendingDashboard()
  const [filter, setFilter] = useState<PendingFilter>('all')

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
            <PendingTasksPanel
              members={data?.members ?? []}
              unassigned={data?.unassigned ?? EMPTY_UNASSIGNED}
              filter={filter}
              onFilterChange={setFilter}
              loading={loading}
              now={now}
              onRefresh={refresh}
              onOpenWatch={(watchId, phase) => {
                const tab = phase === 'SELL' ? 'sell' : 'buy'
                router.push(`/dashboard?tab=${tab}&watch=${watchId}`)
              }}
            />
          </div>

          <div className="pending-ops-aside order-1 lg:order-2">
            <PendingOpsSidebar summary={data?.summary ?? null} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  )
}
