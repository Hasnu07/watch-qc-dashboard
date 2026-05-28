'use client'

import Image from 'next/image'
import { formatCurrency } from '@/lib/utils'
import { DEPT_ORDER, type Department } from '@/lib/ui-constants'

type WatchStage = 'LOGISTICS' | 'ACCOUNTING' | 'SALES'
type PaymentStatus = 'NOT_PAID' | 'PARTIAL' | 'PAID'
type LocationStatus = 'INCOMING' | 'IN_TRANSIT' | 'IN_STOCK'

type DeptCount = { total: number; completed: number }
type TaskSummary = Record<'LOGISTICS' | 'ACCOUNTING' | 'SALES', DeptCount>

interface Watch {
  id: number
  name: string
  brand: string | null
  model: string | null
  ref_no: string | null
  serial_no: string | null
  stock_no: string | null
  watch_date: string | null
  bought_from: string | null
  currency: string
  purchase_price: string | number | null
  convert_rate: string | number | null
  case_material: string | null
  dial_colour: string | null
  bracelet: string | null
  stock_status: string
  origin: string | null
  image_url: string | null
  website_price: string | number
  b2b_price: string | number
  stage: WatchStage
  is_sold: boolean
  payment_status: PaymentStatus
  total_amount: number | null
  location_status: LocationStatus
  location_from: string | null
  location_to: string | null
  transit_pickup_date: string | null
  transit_carrier: string | null
  transit_tracking_number: string | null
  received_date: string | null
  watch_type?: 'BUY' | 'SELL'
  sold_to?: string | null
  task_summary?: TaskSummary
  margin?: number | null
  is_stale?: boolean
  stale_reason?: string | null
  linked_buy_watch_id?: number | null
  fob_url?: string | null
}

interface WatchCardProps {
  watch: Watch
  compact?: boolean
  highlighted?: boolean
  searchHighlight?: string
  onCardClick: (watch: Watch) => void
  onRemoveRequest?: (watch: Watch) => void
  onOpenTasks?: (watch: Watch) => void
}

const STAGE_CFG: Record<Department, { label: string; text: string; dot: string; line: string }> = {
  ACCOUNTING: { label: 'Accounting', text: 'text-amber-700', dot: 'bg-amber-500', line: 'bg-amber-400' },
  SALES: { label: 'Sales', text: 'text-emerald-700', dot: 'bg-emerald-500', line: 'bg-emerald-400' },
  LOGISTICS: { label: 'Logistics', text: 'text-blue-700', dot: 'bg-blue-500', line: 'bg-blue-400' },
}

const TYPE_CFG = {
  BUY: {
    leftBorder: 'border-l-indigo-500',
    headerBg: 'bg-indigo-50/80',
    headerBorder: 'border-indigo-100',
    brandText: 'text-indigo-600',
    imageBg: 'from-indigo-50 to-[#f0f3ff]',
    pricePrimaryBg: 'bg-indigo-50 border-indigo-100',
    pricePrimaryLabel: 'text-indigo-500',
    progressBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  SELL: {
    leftBorder: 'border-l-orange-500',
    headerBg: 'bg-orange-50/80',
    headerBorder: 'border-orange-100',
    brandText: 'text-orange-600',
    imageBg: 'from-orange-50 to-amber-50',
    pricePrimaryBg: 'bg-orange-50 border-orange-100',
    pricePrimaryLabel: 'text-orange-500',
    progressBg: 'bg-orange-50 text-orange-700 border-orange-200',
  },
} as const

function highlightText(text: string, q: string) {
  if (!q || !text.toLowerCase().includes(q.toLowerCase())) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

export default function WatchCard({
  watch, compact = false, highlighted = false, searchHighlight = '',
  onCardClick, onRemoveRequest, onOpenTasks,
}: WatchCardProps) {
  const isSell = watch.watch_type === 'SELL'
  const typeCfg = isSell ? TYPE_CFG.SELL : TYPE_CFG.BUY

  const summary: TaskSummary = watch.task_summary ?? {
    LOGISTICS: { total: 0, completed: 0 },
    ACCOUNTING: { total: 0, completed: 0 },
    SALES: { total: 0, completed: 0 },
  }
  const deptDone = (s: Department) => summary[s].total > 0 && summary[s].completed === summary[s].total
  const allDone = DEPT_ORDER.every(deptDone)
  const doneCount = DEPT_ORDER.filter(deptDone).length

  const payLabel = watch.payment_status === 'PAID' ? '✓ Paid' : watch.payment_status === 'PARTIAL' ? '⏳ Partial' : '✗ Unpaid'
  const payCls = watch.payment_status === 'PAID'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : watch.payment_status === 'PARTIAL'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-red-50 text-red-600 border-red-200'

  if (compact) {
    return (
      <div
        onClick={() => onCardClick(watch)}
        className={`bg-white rounded-xl border-l-4 ${typeCfg.leftBorder} border border-default shadow-sm hover:shadow-md transition-all cursor-pointer flex gap-3 p-3 ${highlighted ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}
      >
        <div className={`relative w-16 h-16 rounded-lg bg-gradient-to-br ${typeCfg.imageBg} flex-shrink-0 overflow-hidden`}>
          {watch.image_url ? (
            <Image src={watch.image_url} alt={watch.name} fill className="object-contain p-1" unoptimized />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-xl">⌚</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              {watch.stock_no && (
                <span className="text-[10px] font-black font-mono-data text-ink">
                  {searchHighlight ? highlightText(`#${watch.stock_no}`, searchHighlight) : `#${watch.stock_no}`}
                </span>
              )}
              <h3 className="text-sm font-bold text-ink truncate">{watch.model || watch.name}</h3>
            </div>
            {onOpenTasks && (
              <button type="button" onClick={e => { e.stopPropagation(); onOpenTasks(watch) }}
                className="text-[9px] font-bold px-2 py-1 rounded-md bg-indigo-100 text-indigo-800 flex-shrink-0">Tasks</button>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${payCls}`}>{payLabel}</span>
            {watch.is_stale && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200" title={watch.stale_reason || undefined}>⏳ Stale</span>
            )}
            {isSell && watch.margin != null && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${watch.margin >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                {formatCurrency(watch.margin)}
              </span>
            )}
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${allDone ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : typeCfg.progressBg}`}>
              {allDone ? '✓ Done' : `${doneCount}/3 depts`}
            </span>
          </div>
        </div>
      </div>
    )
  }

  const tags = [watch.case_material, watch.dial_colour, watch.bracelet].filter(Boolean)
  const locLabel = watch.location_status === 'IN_TRANSIT' ? '🚚 Transit' : watch.location_status === 'IN_STOCK' ? '✅ In Stock' : '📬 Incoming'
  const locCls = watch.location_status === 'IN_TRANSIT'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : watch.location_status === 'IN_STOCK'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-slate-50 text-slate-600 border-slate-200'

  return (
    <div
      onClick={() => onCardClick(watch)}
      className={`bg-white rounded-2xl overflow-hidden border-l-4 ${typeCfg.leftBorder} border border-default shadow-sm hover:shadow-md transition-all group flex flex-col cursor-pointer ${highlighted ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}
    >
      <div className={`px-3 py-1.5 flex items-center justify-between border-b ${typeCfg.headerBorder} ${typeCfg.headerBg}`}>
        <span className={`text-[10px] font-black uppercase tracking-widest ${isSell ? 'text-orange-700' : 'text-indigo-700'}`}>
          {isSell ? '🏷️ Sell' : '🛒 Buy'}
        </span>
        {onRemoveRequest && (
          <button type="button" title="Remove"
            onClick={e => { e.stopPropagation(); onRemoveRequest(watch) }}
            className="text-[10px] font-bold px-2 py-0.5 rounded-md text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200">
            ✕ Remove
          </button>
        )}
      </div>

      <div className={`px-4 pt-3 pb-2 border-b ${typeCfg.headerBorder} ${typeCfg.headerBg}`}>
        <div className="flex items-center gap-0.5">
          {DEPT_ORDER.map((s, i) => {
            const done = deptDone(s)
            const cfg = STAGE_CFG[s]
            return (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className={`w-5 h-5 rounded-full flex-shrink-0 ring-2 ring-white flex items-center justify-center ${done ? cfg.dot : 'bg-[#c7c4d8]'}`}>
                  {done && <span className="text-white text-[10px] font-black">✓</span>}
                </div>
                {i < DEPT_ORDER.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 rounded-full ${deptDone(DEPT_ORDER[i]) ? cfg.line : 'bg-[#dee2ef]'}`} />
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-1.5">
          {DEPT_ORDER.map(s => (
            <span key={s} className={`text-[9px] font-bold tracking-widest uppercase ${deptDone(s) ? STAGE_CFG[s].text : 'text-muted'}`}>
              {STAGE_CFG[s].label}
            </span>
          ))}
        </div>
      </div>

      <div className={`px-3 pt-2 pb-1.5 flex items-center gap-1.5 border-b ${typeCfg.headerBorder} ${typeCfg.headerBg}`}>
        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${payCls}`}>{payLabel}</span>
        {watch.is_stale && (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200" title={watch.stale_reason || undefined}>⏳ Stale</span>
        )}
        {isSell && watch.linked_buy_watch_id && (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-violet-50 text-violet-700 border-violet-200">↔ Buy #{watch.linked_buy_watch_id}</span>
        )}
        {isSell ? (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border ml-auto bg-orange-100 text-orange-800 border-orange-200">Sale</span>
        ) : (
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ml-auto ${locCls}`}>{locLabel}</span>
        )}
      </div>

      <div className={`relative w-full aspect-[4/3] bg-gradient-to-br ${typeCfg.imageBg} overflow-hidden`}>
        {watch.image_url ? (
          <Image src={watch.image_url} alt={watch.name} fill className="object-contain p-3 group-hover:scale-105 transition-transform duration-300" unoptimized />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#c7c4d8]">
            <span className="text-4xl">⌚</span>
            <span className="text-xs font-medium text-muted">No image</span>
          </div>
        )}
        {watch.stock_no && (
          <div className="absolute top-2 left-2">
            <span className="text-xs font-black px-2.5 py-1 rounded-lg shadow-sm bg-[#2c313a] text-white font-mono-data">
              {searchHighlight ? highlightText(`#${watch.stock_no}`, searchHighlight) : `#${watch.stock_no}`}
            </span>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2.5 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {watch.brand && <p className={`text-[10px] font-black uppercase tracking-widest ${typeCfg.brandText}`}>{watch.brand}</p>}
            <h3 className="text-ink font-bold text-base leading-tight">{watch.model || watch.name}</h3>
          </div>
          {onOpenTasks && (
            <button type="button" onClick={e => { e.stopPropagation(); onOpenTasks(watch) }}
              className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border ${isSell ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-indigo-100 text-indigo-800 border-indigo-200'}`}>
              📋 Tasks
            </button>
          )}
        </div>
        {(watch.ref_no || watch.watch_date) && (
          <p className="text-muted text-xs font-mono-data">
            {watch.ref_no && <>Ref. {watch.ref_no}</>}
            {watch.ref_no && watch.watch_date && <span className="text-[#c7c4d8]"> · </span>}
            {watch.watch_date}
          </p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, i) => (
              <span key={i} className="text-[11px] bg-panel text-[#464555] px-2 py-0.5 rounded-md font-medium border border-default">{tag}</span>
            ))}
          </div>
        )}
        {isSell && watch.sold_to && <p className="text-muted text-xs">👤 {watch.sold_to}</p>}
        {!isSell && watch.bought_from && <p className="text-muted text-xs">📍 {watch.bought_from}</p>}
        {isSell && watch.margin != null && (
          <p className={`text-xs font-bold ${watch.margin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            Margin: {formatCurrency(watch.margin)}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 mt-auto">
          <div className={`rounded-xl p-2.5 border ${typeCfg.pricePrimaryBg}`}>
            <div className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${typeCfg.pricePrimaryLabel}`}>{isSell ? 'Sale' : 'Website'}</div>
            <div className="text-ink font-black text-base font-mono-data">{formatCurrency(watch.website_price)}</div>
          </div>
          <div className={`rounded-xl p-2.5 border ${isSell ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
            <div className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${isSell ? 'text-amber-600' : 'text-emerald-500'}`}>{isSell ? 'Stock #' : 'B2B'}</div>
            <div className={`font-black text-base font-mono-data ${isSell ? 'text-amber-900' : 'text-emerald-900'}`}>
              {isSell && watch.stock_no ? `#${watch.stock_no}` : formatCurrency(watch.b2b_price)}
            </div>
          </div>
        </div>
        <div className={`w-full py-2.5 rounded-full font-bold text-sm text-center border ${allDone ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : typeCfg.progressBg}`}>
          {allDone ? '✓ All tasks complete' : `${doneCount}/${DEPT_ORDER.length} departments done`}
        </div>
      </div>
    </div>
  )
}
