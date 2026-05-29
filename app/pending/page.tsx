'use client'

import { useRouter } from 'next/navigation'
import PendingTasksPanel from '@/components/PendingTasksPanel'

export default function PendingPage() {
  const router = useRouter()

  return (
    <div className="flex flex-col flex-1 min-h-[calc(100dvh-3rem)]">
      <div className="px-4 py-4 border-b border-default bg-panel sm:px-6 flex-shrink-0">
        <h1 className="text-lg font-semibold text-ink">Pending Tasks</h1>
        <p className="text-xs text-muted mt-0.5">Team + watch tasks by person</p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <PendingTasksPanel
          onOpenWatch={(watchId, phase) => {
            const tab = phase === 'SELL' ? 'sell' : 'buy'
            router.push(`/dashboard?tab=${tab}&watch=${watchId}`)
          }}
        />
      </div>
    </div>
  )
}
