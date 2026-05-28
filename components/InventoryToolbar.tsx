'use client'

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
  const set = (patch: Partial<InventoryFilters>) => onChange({ ...filters, ...patch })

  const chipCls = (active: boolean) => active ? 'chip-active' : 'chip hover:border-accent/40 hover:text-ink'

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="search"
          value={filters.search}
          onChange={e => set({ search: e.target.value })}
          placeholder="Search stock #, ref, brand, buyer…"
          className="input-field flex-1"
        />
        <button
          type="button"
          onClick={() => onCompactModeChange(!compactMode)}
          title={compactMode ? 'Expanded cards' : 'Compact cards'}
          className="btn-ghost whitespace-nowrap text-xs"
        >
          {compactMode ? '▦ Expand' : '▤ Compact'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(['all', 'BUY', 'SELL'] as WatchTypeFilter[]).map(v => (
          <button key={v} type="button" onClick={() => set({ watchType: v })}
            className={chipCls(filters.watchType === v)}>
            {v === 'all' ? 'All types' : v === 'BUY' ? 'Buy' : 'Sell'}
          </button>
        ))}
        {(['all', 'NOT_PAID', 'PARTIAL', 'PAID'] as PaymentFilter[]).map(v => (
          <button key={v} type="button" onClick={() => set({ payment: v })}
            className={chipCls(filters.payment === v)}>
            {v === 'all' ? 'Any payment' : v === 'NOT_PAID' ? 'Unpaid' : v === 'PARTIAL' ? 'Partial' : 'Paid'}
          </button>
        ))}
        {(['all', 'INCOMING', 'IN_TRANSIT', 'IN_STOCK'] as LocationFilter[]).map(v => (
          <button key={v} type="button" onClick={() => set({ location: v })}
            className={chipCls(filters.location === v)}>
            {v === 'all' ? 'Any location' : v === 'INCOMING' ? 'Incoming' : v === 'IN_TRANSIT' ? 'Transit' : 'In stock'}
          </button>
        ))}
      </div>
    </div>
  )
}
