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

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="search"
          value={filters.search}
          onChange={e => set({ search: e.target.value })}
          placeholder="Search stock #, ref, brand, buyer…"
          className="flex-1 bg-white border border-[#c7c4d8] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50"
        />
        <button
          type="button"
          onClick={() => onCompactModeChange(!compactMode)}
          title={compactMode ? 'Expanded cards' : 'Compact cards'}
          className="px-3 py-2 rounded-xl border border-[#c7c4d8] bg-white text-xs font-bold text-slate-600 hover:border-indigo-300 whitespace-nowrap"
        >
          {compactMode ? '▦ Expand' : '▤ Compact'}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(['all', 'BUY', 'SELL'] as WatchTypeFilter[]).map(v => (
          <button key={v} type="button" onClick={() => set({ watchType: v })}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
              filters.watchType === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}>
            {v === 'all' ? 'All types' : v === 'BUY' ? '🛒 Buy' : '🏷️ Sell'}
          </button>
        ))}
        {(['all', 'NOT_PAID', 'PARTIAL', 'PAID'] as PaymentFilter[]).map(v => (
          <button key={v} type="button" onClick={() => set({ payment: v })}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
              filters.payment === v ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}>
            {v === 'all' ? 'Any payment' : v === 'NOT_PAID' ? 'Unpaid' : v === 'PARTIAL' ? 'Partial' : 'Paid'}
          </button>
        ))}
        {(['all', 'INCOMING', 'IN_TRANSIT', 'IN_STOCK'] as LocationFilter[]).map(v => (
          <button key={v} type="button" onClick={() => set({ location: v })}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
              filters.location === v ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
            }`}>
            {v === 'all' ? 'Any location' : v === 'INCOMING' ? 'Incoming' : v === 'IN_TRANSIT' ? 'Transit' : 'In stock'}
          </button>
        ))}
      </div>
    </div>
  )
}
