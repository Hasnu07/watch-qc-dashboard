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
  onTaskDone: (id: number) => void
}

const STAGES: WatchStage[] = ['LOGISTICS', 'ACCOUNTING', 'SALES']

const STAGE_CFG = {
  LOGISTICS: {
    label: 'Logistics',
    text: 'text-cyan-400',
    dot: 'bg-cyan-500',
    line: 'bg-cyan-500',
    glow: 'shadow-[0_0_10px_rgba(0,210,255,0.5)]',
    border: 'border-l-cyan-500',
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  },
  ACCOUNTING: {
    label: 'Accounting',
    text: 'text-amber-400',
    dot: 'bg-amber-500',
    line: 'bg-amber-500',
    glow: 'shadow-[0_0_10px_rgba(251,191,36,0.5)]',
    border: 'border-l-amber-500',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  SALES: {
    label: 'Sales',
    text: 'text-emerald-400',
    dot: 'bg-emerald-500',
    line: 'bg-emerald-500',
    glow: 'shadow-[0_0_10px_rgba(52,211,153,0.5)]',
    border: 'border-l-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
}

export default function WatchCard({ watch, onCardClick, onTaskDone }: WatchCardProps) {
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
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    : watch.payment_status === 'PARTIAL'
      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      : 'bg-pink-500/15 text-pink-300 border-pink-500/30'

  const transitDays = watch.transit_pickup_date
    ? Math.floor((Date.now() - new Date(watch.transit_pickup_date).getTime()) / (1000 * 60 * 60 * 24))
    : null
  const locLabel = watch.location_status === 'IN_TRANSIT'
    ? `🚚 Transit${transitDays != null ? ` · Day ${transitDays}` : ''}`
    : watch.location_status === 'IN_STOCK'
      ? '✅ In Stock'
      : '📬 Incoming'
  const locCls = watch.location_status === 'IN_TRANSIT'
    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
    : watch.location_status === 'IN_STOCK'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : 'bg-white/10 text-white/50 border-white/15'

  return (
    <div
      onClick={() => onCardClick(watch)}
      className={`glass rounded-2xl overflow-hidden border-l-4 ${cfg.border} hover:bg-white/[0.09] transition-all duration-300 hover:shadow-[0_8px_40px_rgba(0,0,0,0.35)] group flex flex-col cursor-pointer`}
    >
      {/* Pipeline bar */}
      <div className="px-4 pt-3 pb-2 bg-white/[0.03] border-b border-white/[0.07]">
        <div className="flex items-center gap-0.5">
          {STAGES.map((s, i) => {
            const done = deptDone(s)
            return (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className={`w-5 h-5 rounded-full flex-shrink-0 ring-2 ring-black/20 transition-all flex items-center justify-center ${
                  done ? `${STAGE_CFG[s].dot} ${STAGE_CFG[s].glow}` : 'bg-white/10'
                }`}>
                  {done && <span className="text-white text-[10px] font-black leading-none">✓</span>}
                </div>
                {i < STAGES.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 rounded-full transition-colors ${
                    deptDone(STAGES[i]) ? STAGE_CFG[STAGES[i]].line : 'bg-white/10'
                  }`} />
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-1.5">
          {STAGES.map(s => {
            const done = deptDone(s)
            return (
              <span key={s} className={`text-[9px] font-bold tracking-widest uppercase ${
                done ? STAGE_CFG[s].text : 'text-white/25'
              }`}>
                {STAGE_CFG[s].label}
              </span>
            )
          })}
        </div>
      </div>

      {/* Payment + Location badges */}
      <div className="px-3 pt-2 pb-1.5 flex items-center gap-1.5 bg-white/[0.02] border-b border-white/[0.06]">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${payCls}`}>{payLabel}</span>
        {isSell ? (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border ml-auto bg-orange-500/15 text-orange-300 border-orange-500/30">🏷️ Sell</span>
        ) : (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ml-auto ${locCls}`}>{locLabel}</span>
        )}
      </div>

      {/* Image */}
      <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-white/[0.03] to-white/[0.06] overflow-hidden">
        {watch.image_url ? (
          <Image src={watch.image_url} alt={watch.name} fill
            className="object-contain p-3 group-hover:scale-105 transition-transform duration-300" unoptimized />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-white/20">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-medium">No image</span>
          </div>
        )}
        {watch.stock_no && (
          <div className="absolute top-2 left-2">
            <span className="text-xs font-black px-2.5 py-1 rounded-lg glass-strong text-white tracking-wide border border-white/20">
              # {watch.stock_no}
            </span>
          </div>
        )}
        {!isSell && (
          <div className="absolute top-2 right-2">
            <span className={`text-xs font-bold px-2 py-1 rounded-full border ${
              watch.stock_status === 'STOCK'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}>
              {watch.stock_status === 'STOCK' ? '✓ In Stock' : '⏳ Incoming'}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col gap-2.5 flex-1">

        {watch.origin && (
          <span className="text-[11px] font-medium text-white/40 px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] w-fit">
            {watch.origin}
          </span>
        )}

        <div>
          {watch.brand && (
            <p className="text-[11px] font-black uppercase tracking-widest mb-0.5 text-gradient-cyan">{watch.brand}</p>
          )}
          <h3 className="text-white font-bold text-base leading-tight">
            {watch.model || watch.name}
          </h3>
          {(watch.ref_no || watch.stock_no || watch.watch_date) && (
            <p className="text-white/35 text-xs mt-0.5 font-medium">
              {watch.ref_no && <>Ref. {watch.ref_no}</>}
              {watch.ref_no && watch.stock_no && <span className="text-white/20"> · </span>}
              {watch.stock_no && <span className="text-white/70 font-bold">#{watch.stock_no}</span>}
              {(watch.ref_no || watch.stock_no) && watch.watch_date && <span className="text-white/20"> · </span>}
              {watch.watch_date && <>{watch.watch_date}</>}
            </p>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, i) => (
              <span key={i} className="text-[11px] bg-white/[0.07] text-white/60 px-2 py-0.5 rounded-md font-medium border border-white/[0.10]">
                {tag}
              </span>
            ))}
          </div>
        )}

        {isSell && watch.sold_to && (
          <p className="text-white/40 text-xs font-medium">👤 Sold to: {watch.sold_to}</p>
        )}
        {!isSell && watch.bought_from && (
          <p className="text-white/40 text-xs font-medium">📍 From: {watch.bought_from}</p>
        )}

        {/* Price boxes */}
        <div className="grid grid-cols-2 gap-2 mt-auto">
          <div className="bg-cyan-500/10 rounded-xl p-2.5 border border-cyan-500/20">
            <div className="text-cyan-400 text-[9px] font-black uppercase tracking-widest mb-0.5">Website</div>
            <div className="text-white font-black text-base">{formatCurrency(watch.website_price)}</div>
          </div>
          <div className="bg-emerald-500/10 rounded-xl p-2.5 border border-emerald-500/20">
            <div className="text-emerald-400 text-[9px] font-black uppercase tracking-widest mb-0.5">B2B</div>
            <div className="text-white font-black text-base">{formatCurrency(watch.b2b_price)}</div>
          </div>
        </div>

        {/* Task Done button */}
        <button
          onClick={(e) => { e.stopPropagation(); onTaskDone(watch.id) }}
          className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
            allDone
              ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-[0_0_20px_rgba(52,211,153,0.35)] hover:shadow-[0_0_30px_rgba(52,211,153,0.5)]'
              : 'bg-white/[0.06] hover:bg-white/[0.10] text-white/40 hover:text-white/70 border border-white/[0.10]'
          }`}>
          {allDone ? '✓ Task Done' : '✓ Task Done'}
        </button>

      </div>
    </div>
  )
}
