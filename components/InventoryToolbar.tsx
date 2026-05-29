'use client'

import { useState } from 'react'

type WatchTypeFilter = 'all' | 'BUY' | 'SELL'
type PaymentFilter = 'all' | 'NOT_PAID' | 'PARTIAL' | 'PAID'
type LocationFilter = 'all' | 'INCOMING' | 'IN_TRANSIT' | 'IN_STOCK'

export interface InventoryFilters {
  search: string
  watchType: WatchTypeFilter
  payment: PaymentFilter
  location: LocationFilter
}

interface Props {
  filters: InventoryFilters
  onChange: (filters: InventoryFilters) => void
  compactMode: boolean
  onCompactModeChange: (v: boolean) => void
}

export default function InventoryToolbar({ filters, onChange, compactMode, onCompactModeChange }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const set = (patch: Partial<InventoryFilters>) => onChange({ ...filters, ...patch })

  const chipCls = (active: boolean) => active ? 'chip-active' : 'chip'

  const hasAdvanced =
    filters.payment !== 'all' || filters.location !== 'all'

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="search"
          value={filters.search}
          onChange={e => set({ search: e.target.value })}
          placeholder="Search stock #, brand, ref…"
          className="input-field flex-1"
          aria-label="Search watches"
        />
        <button
          type="button"
          onClick={() => onCompactModeChange(!compactMode)}
          title={compactMode ? 'Show card view' : 'Show list view'}
          className="btn-ghost whitespace-nowrap text-xs shrink-0"
        >
          {compactMode ? 'Cards' : 'List'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'BUY', 'SELL'] as WatchTypeFilter[]).map(v => (
          <button key={v} type="button" onClick={() => set({ watchType: v })}
            className={chipCls(filters.watchType === v)}>
            {v === 'all' ? 'All' : v === 'BUY' ? 'Buy' : 'Sell'}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowAdvanced(o => !o)}
          className={`${chipCls(showAdvanced || hasAdvanced)} ml-auto`}
        >
          {showAdvanced ? 'Hide filters' : hasAdvanced ? 'Filters active' : 'More filters'}
        </button>
      </div>

      {showAdvanced && (
        <div className="rounded-lg border border-default bg-panel p-3 space-y-2">
          <p className="text-xs text-muted font-medium">Payment</p>
          <div className="flex flex-wrap gap-2">
            {(['all', 'NOT_PAID', 'PARTIAL', 'PAID'] as PaymentFilter[]).map(v => (
              <button key={v} type="button" onClick={() => set({ payment: v })}
                className={chipCls(filters.payment === v)}>
                {v === 'all' ? 'Any' : v === 'NOT_PAID' ? 'Unpaid' : v === 'PARTIAL' ? 'Partial' : 'Paid'}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted font-medium pt-1">Location</p>
          <div className="flex flex-wrap gap-2">
            {(['all', 'INCOMING', 'IN_TRANSIT', 'IN_STOCK'] as LocationFilter[]).map(v => (
              <button key={v} type="button" onClick={() => set({ location: v })}
                className={chipCls(filters.location === v)}>
                {v === 'all' ? 'Any' : v === 'INCOMING' ? 'Incoming' : v === 'IN_TRANSIT' ? 'Transit' : 'In stock'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
