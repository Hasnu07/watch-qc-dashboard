'use client'

import Image from 'next/image'
import { formatCurrency } from '@/lib/utils'

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
  task_summary?: TaskSummary
}

interface WatchCardProps {
  watch: Watch
  onCardClick: (watch: Watch) => void
  onTaskDone: (id: number) => void
}

const STAGES: WatchStage[] = ['LOGISTICS', 'ACCOUNTING', 'SALES']

const STAGE_CFG = {
  LOGISTICS: {
    label: 'Logistics',
    color: 'text-blue-700',
    dot: 'bg-blue-500',
    line: 'bg-blue-400',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    leftBorder: 'border-l-blue-500',
  },
  ACCOUNTING: {
    label: 'Accounting',
    color: 'text-amber-700',
    dot: 'bg-amber-500',
    line: 'bg-amber-400',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    leftBorder: 'border-l-amber-500',
  },
  SALES: {
    label: 'Sales',
    color: 'text-emerald-700',
    dot: 'bg-emerald-500',
    line: 'bg-emerald-400',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    leftBorder: 'border-l-emerald-500',
  },
}

export default function WatchCard({ watch, onCardClick, onTaskDone }: WatchCardProps) {
  const cfg = STAGE_CFG[watch.stage]
  const isSell = watch.watch_type === 'SELL'

  // Department completion derived from task summary
  const summary: TaskSummary = watch.task_summary ?? {
    LOGISTICS: { total: 0, completed: 0 },
    ACCOUNTING: { total: 0, completed: 0 },
    SALES: { total: 0, completed: 0 },
  }
  const deptDone = (s: WatchStage) => summary[s].total > 0 && summary[s].completed === summary[s].total
  const allDone = STAGES.every(deptDone)

  const tags = [watch.case_material, watch.dial_colour, watch.bracelet].filter(Boolean)

  // Payment badge
  const payLabel = watch.payment_status === 'PAID' ? '✓ Paid' : watch.payment_status === 'PARTIAL' ? '⏳ Partial' : '✗ Unpaid'
  const payCls = watch.payment_status === 'PAID'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : watch.payment_status === 'PARTIAL'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-red-50 text-red-600 border-red-200'

  // Location badge
  const transitDays = watch.transit_pickup_date
    ? Math.floor((Date.now() - new Date(watch.transit_pickup_date).getTime()) / (1000 * 60 * 60 * 24))
    : null
  const locLabel = watch.location_status === 'IN_TRANSIT'
    ? `🚚 Transit${transitDays != null ? ` · Day ${transitDays}` : ''}`
    : watch.location_status === 'IN_STOCK'
      ? '✅ In Stock'
      : '📬 Incoming'
  const locCls = watch.location_status === 'IN_TRANSIT'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : watch.location_status === 'IN_STOCK'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-slate-50 text-slate-600 border-slate-200'

  return (
    <div
      onClick={() => onCardClick(watch)}
      className={`bg-white rounded-2xl overflow-hidden border-l-4 ${cfg.leftBorder} border border-slate-200 shadow-sm hover:shadow-md transition-all group flex flex-col cursor-pointer`}
    >
      {/* Pipeline bar — each dot becomes a check when that dept's tasks are all done */}
      <div className="px-4 pt-3 pb-2 bg-slate-50 border-b border-slate-100">
        <div className="flex items-center gap-0.5">
          {STAGES.map((s, i) => {
            const done = deptDone(s)
            return (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className={`w-5 h-5 rounded-full flex-shrink-0 ring-2 ring-white transition-colors flex items-center justify-center ${
                  done ? STAGE_CFG[s].dot : 'bg-slate-300'
                }`}>
                  {done && <span className="text-white text-[10px] font-black leading-none">✓</span>}
                </div>
                {i < STAGES.length - 1 && (
                  <div className={`flex-1 h-1 mx-1 rounded-full transition-colors ${
                    deptDone(STAGES[i]) ? STAGE_CFG[STAGES[i]].line : 'bg-slate-200'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-1">
          {STAGES.map(s => {
            const done = deptDone(s)
            return (
              <span key={s} className={`text-[10px] font-bold tracking-wide ${
                done ? STAGE_CFG[s].color : 'text-slate-400'
              }`}>
                {STAGE_CFG[s].label.toUpperCase()}
              </span>
            )
          })}
        </div>
      </div>

      {/* Payment + Location/Sell badges */}
      <div className="px-3 pt-2 pb-1 flex items-center gap-1.5 bg-slate-50 border-b border-slate-100">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${payCls}`}>{payLabel}</span>
        {isSell ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border ml-auto bg-orange-50 text-orange-700 border-orange-200">🏷️ Sell</span>
        ) : (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ml-auto ${locCls}`}>{locLabel}</span>
        )}
      </div>

      {/* Image */}
      <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
        {watch.image_url ? (
          <Image src={watch.image_url} alt={watch.name} fill
            className="object-contain p-3 group-hover:scale-105 transition-transform duration-300" unoptimized />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-300">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium">No image</span>
          </div>
        )}
        {/* Stock No badge — top-left, prominent identifier */}
        {watch.stock_no && (
          <div className="absolute top-2 left-2">
            <span className="text-xs font-black px-2.5 py-1 rounded-md shadow-sm border bg-slate-900 text-white border-slate-900 tracking-wide">
              # {watch.stock_no}
            </span>
          </div>
        )}
        {/* Stock status pill — only for Buy watches (irrelevant for Sell) */}
        {!isSell && (
          <div className="absolute top-2 right-2">
            <span className={`text-xs font-bold px-2 py-1 rounded-full shadow-sm border ${
              watch.stock_status === 'STOCK'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : 'bg-amber-100 text-amber-800 border-amber-200'
            }`}>
              {watch.stock_status === 'STOCK' ? '✓ In Stock' : '⏳ Incoming'}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-2.5 flex-1">

        {/* Origin only — stage label moved to pipeline checkmarks above */}
        {watch.origin && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-medium text-slate-500 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
              {watch.origin}
            </span>
          </div>
        )}

        {/* Brand + Model */}
        <div>
          {watch.brand && (
            <p className="text-indigo-600 text-xs font-black uppercase tracking-widest mb-0.5">{watch.brand}</p>
          )}
          <h3 className="text-slate-900 font-bold text-base leading-tight">
            {watch.model || watch.name}
          </h3>
          {(watch.ref_no || watch.stock_no || watch.watch_date) && (
            <p className="text-slate-400 text-xs mt-0.5 font-medium">
              {watch.ref_no && <>Ref. {watch.ref_no}</>}
              {watch.ref_no && watch.stock_no && <span className="text-slate-300"> · </span>}
              {watch.stock_no && <span className="text-slate-700 font-bold">#{watch.stock_no}</span>}
              {(watch.ref_no || watch.stock_no) && watch.watch_date && <span className="text-slate-300"> · </span>}
              {watch.watch_date && <>{watch.watch_date}</>}
            </p>
          )}
        </div>

        {/* Spec tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, i) => (
              <span key={i} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium border border-slate-200">
                {tag}
              </span>
            ))}
          </div>
        )}

        {watch.bought_from && (
          <p className="text-slate-400 text-xs font-medium">📍 From: {watch.bought_from}</p>
        )}

        {/* Prices */}
        <div className="grid grid-cols-2 gap-2 mt-auto">
          <div className="bg-blue-50 rounded-xl p-2.5 border border-blue-100">
            <div className="text-blue-500 text-[10px] font-bold uppercase tracking-wide mb-0.5">Website</div>
            <div className="text-blue-800 font-black text-base">{formatCurrency(watch.website_price)}</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-100">
            <div className="text-emerald-500 text-[10px] font-bold uppercase tracking-wide mb-0.5">B2B</div>
            <div className="text-emerald-800 font-black text-base">{formatCurrency(watch.b2b_price)}</div>
          </div>
        </div>

        {/* Task Done — removes the card from the dashboard */}
        <button
          onClick={(e) => { e.stopPropagation(); onTaskDone(watch.id) }}
          className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
            allDone
              ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
              : 'bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 border border-slate-200'
          }`}>
          {allDone ? '✓ Task Done' : '✓ Task Done'}
        </button>

      </div>
    </div>
  )
}
