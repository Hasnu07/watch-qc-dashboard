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
  sold_to?: string | null
  task_summary?: TaskSummary
}

interface WatchCardProps {
  watch: Watch
  onCardClick: (watch: Watch) => void
}

const STAGES: WatchStage[] = ['LOGISTICS', 'ACCOUNTING', 'SALES']

const STAGE_CFG = {
  LOGISTICS: {
    label: 'Logistics',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    line: 'bg-blue-400',
    dotGlow: '',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    leftBorder: 'border-l-blue-500',
    priceBg: 'bg-blue-50 border-blue-100',
    priceLabel: 'text-blue-500',
    priceVal: 'text-blue-900',
  },
  ACCOUNTING: {
    label: 'Accounting',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    line: 'bg-amber-400',
    dotGlow: '',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    leftBorder: 'border-l-amber-500',
    priceBg: 'bg-amber-50 border-amber-100',
    priceLabel: 'text-amber-500',
    priceVal: 'text-amber-900',
  },
  SALES: {
    label: 'Sales',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    line: 'bg-emerald-400',
    dotGlow: '',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    leftBorder: 'border-l-emerald-500',
    priceBg: 'bg-emerald-50 border-emerald-100',
    priceLabel: 'text-emerald-500',
    priceVal: 'text-emerald-900',
  },
}

export default function WatchCard({ watch, onCardClick }: WatchCardProps) {
  const cfg = STAGE_CFG[watch.stage]
  const isSell = watch.watch_type === 'SELL'

  const summary: TaskSummary = watch.task_summary ?? {
    LOGISTICS: { total: 0, completed: 0 },
    ACCOUNTING: { total: 0, completed: 0 },
    SALES: { total: 0, completed: 0 },
  }
  const deptDone = (s: WatchStage) => summary[s].total > 0 && summary[s].completed === summary[s].total
  const allDone = STAGES.every(deptDone)

  const tags = [watch.case_material, watch.dial_colour, watch.bracelet].filter(Boolean)

  const payLabel = watch.payment_status === 'PAID' ? '✓ Paid' : watch.payment_status === 'PARTIAL' ? '⏳ Partial' : '✗ Unpaid'
  const payCls = watch.payment_status === 'PAID'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : watch.payment_status === 'PARTIAL'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-red-50 text-red-600 border-red-200'

  const transitDays = watch.transit_pickup_date
    ? Math.floor((Date.now() - new Date(watch.transit_pickup_date).getTime()) / (1000 * 60 * 60 * 24))
    : null
  const locLabel = watch.location_status === 'IN_TRANSIT'
    ? `🚚 Transit${transitDays != null ? ` · Day ${transitDays}` : ''}`
    : watch.location_status === 'IN_STOCK' ? '✅ In Stock' : '📬 Incoming'
  const locCls = watch.location_status === 'IN_TRANSIT'
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : watch.location_status === 'IN_STOCK'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-slate-50 text-slate-600 border-slate-200'

  return (
    <div
      onClick={() => onCardClick(watch)}
      className={`bg-white rounded-2xl overflow-hidden border-l-4 ${cfg.leftBorder} border border-[#c7c4d8] shadow-[0_1px_4px_rgba(15,23,42,0.06)] hover:shadow-[0_4px_16px_rgba(15,23,42,0.10)] transition-all group flex flex-col cursor-pointer`}
    >
      {/* Pipeline dots */}
      <div className="px-4 pt-3 pb-2 bg-[#f0f3ff] border-b border-[#e4e8f5]">
        <div className="flex items-center gap-0.5">
          {STAGES.map((s, i) => {
            const done = deptDone(s)
            return (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className={`w-5 h-5 rounded-full flex-shrink-0 ring-2 ring-white transition-colors flex items-center justify-center ${done ? STAGE_CFG[s].dot : 'bg-[#c7c4d8]'}`}>
                  {done && <span className="text-white text-[10px] font-black leading-none">✓</span>}
                </div>
                {i < STAGES.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${deptDone(STAGES[i]) ? STAGE_CFG[STAGES[i]].line : 'bg-[#dee2ef]'}`} />
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-1.5">
          {STAGES.map(s => (
            <span key={s} className={`text-[9px] font-bold tracking-widest uppercase ${deptDone(s) ? STAGE_CFG[s].text : 'text-[#777587]'}`}>
              {STAGE_CFG[s].label}
            </span>
          ))}
        </div>
      </div>

      {/* Badges row */}
      <div className="px-3 pt-2 pb-1.5 flex items-center gap-1.5 bg-[#f0f3ff] border-b border-[#e4e8f5]">
        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${payCls}`}>{payLabel}</span>
        {isSell ? (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full border ml-auto bg-orange-50 text-orange-700 border-orange-200">🏷️ Sell</span>
        ) : (
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ml-auto ${locCls}`}>{locLabel}</span>
        )}
      </div>

      {/* Image */}
      <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-slate-50 to-[#f0f3ff] overflow-hidden">
        {watch.image_url ? (
          <Image src={watch.image_url} alt={watch.name} fill
            className="object-contain p-3 group-hover:scale-105 transition-transform duration-300" unoptimized />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-[#c7c4d8]">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium text-[#777587]">No image</span>
          </div>
        )}
        {watch.stock_no && (
          <div className="absolute top-2 left-2">
            <span className="text-xs font-black px-2.5 py-1 rounded-lg shadow-sm bg-[#2c313a] text-white tracking-wide font-mono-data">
              #{watch.stock_no}
            </span>
          </div>
        )}
        {!isSell && (
          <div className="absolute top-2 right-2">
            <span className={`text-xs font-bold px-2 py-1 rounded-full shadow-sm border ${watch.stock_status === 'STOCK' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
              {watch.stock_status === 'STOCK' ? '✓ In Stock' : '⏳ Incoming'}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-2.5 flex-1">
        {watch.brand && (
          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-0">{watch.brand}</p>
        )}
        <div>
          <h3 className="text-[#171c25] font-bold text-base leading-tight">
            {watch.model || watch.name}
          </h3>
          {(watch.ref_no || watch.stock_no || watch.watch_date) && (
            <p className="text-[#777587] text-xs mt-0.5 font-mono-data">
              {watch.ref_no && <>Ref. {watch.ref_no}</>}
              {watch.ref_no && watch.stock_no && <span className="text-[#c7c4d8]"> · </span>}
              {watch.stock_no && <span className="text-[#464555] font-bold">#{watch.stock_no}</span>}
              {(watch.ref_no || watch.stock_no) && watch.watch_date && <span className="text-[#c7c4d8]"> · </span>}
              {watch.watch_date && <>{watch.watch_date}</>}
            </p>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, i) => (
              <span key={i} className="text-[11px] bg-[#eaeefb] text-[#464555] px-2 py-0.5 rounded-md font-medium border border-[#c7c4d8]">
                {tag}
              </span>
            ))}
          </div>
        )}

        {isSell && watch.sold_to && (
          <p className="text-[#777587] text-xs font-medium">👤 Sold to: {watch.sold_to}</p>
        )}
        {!isSell && watch.bought_from && (
          <p className="text-[#777587] text-xs font-medium">📍 From: {watch.bought_from}</p>
        )}

        {/* Prices */}
        <div className="grid grid-cols-2 gap-2 mt-auto">
          <div className="bg-[#f0f3ff] rounded-xl p-2.5 border border-[#dae2fd]">
            <div className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-0.5">Website</div>
            <div className="text-[#171c25] font-black text-base font-mono-data">{formatCurrency(watch.website_price)}</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-2.5 border border-emerald-100">
            <div className="text-[9px] font-black uppercase tracking-widest text-emerald-500 mb-0.5">B2B</div>
            <div className="text-emerald-900 font-black text-base font-mono-data">{formatCurrency(watch.b2b_price)}</div>
          </div>
        </div>

        {/* Task progress — auto-removed from dashboard when all phase tasks are complete */}
        <div className={`w-full py-2.5 rounded-full font-bold text-sm text-center ${
          allDone
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-[#eaeefb] text-[#464555] border border-[#c7c4d8]'
        }`}>
          {allDone ? '✓ All tasks complete' : `${STAGES.filter(deptDone).length}/${STAGES.length} departments done`}
        </div>
      </div>
    </div>
  )
}
