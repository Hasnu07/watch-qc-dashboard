'use client'

import Image from 'next/image'
import { formatCurrency } from '@/lib/utils'

type WatchStage = 'LOGISTICS' | 'ACCOUNTING' | 'SALES'

interface Watch {
  id: number
  name: string
  brand: string | null
  model: string | null
  ref_no: string | null
  serial_no: string | null
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
}

interface WatchCardProps {
  watch: Watch
  onAdvance: (id: number, stage: WatchStage) => void
  onMarkSold: (id: number) => void
}

const STAGES: WatchStage[] = ['LOGISTICS', 'ACCOUNTING', 'SALES']

const STAGE_CFG = {
  LOGISTICS: {
    label: 'Logistics', color: 'text-blue-400', dot: 'bg-blue-400',
    btnCls: 'bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border-blue-600/30 hover:border-blue-600',
    nextLabel: 'Move to Accounting →', nextStage: 'ACCOUNTING' as WatchStage,
  },
  ACCOUNTING: {
    label: 'Accounting', color: 'text-amber-400', dot: 'bg-amber-400',
    btnCls: 'bg-amber-600/20 hover:bg-amber-500 text-amber-300 hover:text-white border-amber-500/30 hover:border-amber-500',
    nextLabel: 'Move to Sales →', nextStage: 'SALES' as WatchStage,
  },
  SALES: {
    label: 'Sales', color: 'text-green-400', dot: 'bg-green-400',
    btnCls: 'bg-red-500/15 hover:bg-red-500 text-red-400 hover:text-white border-red-500/30 hover:border-red-500',
    nextLabel: 'Mark as Sold ✓', nextStage: 'SALES' as WatchStage,
  },
}

export default function WatchCard({ watch, onAdvance, onMarkSold }: WatchCardProps) {
  const cfg = STAGE_CFG[watch.stage]
  const stageIdx = STAGES.indexOf(watch.stage)

  const handleAction = () => {
    if (watch.stage === 'SALES') onMarkSold(watch.id)
    else onAdvance(watch.id, cfg.nextStage)
  }

  const tags = [watch.case_material, watch.dial_colour, watch.bracelet].filter(Boolean)

  return (
    <div className="bg-[#16161f] rounded-2xl overflow-hidden border border-white/10 hover:border-white/20 transition-all group flex flex-col">

      {/* Pipeline bar */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-1">
          {STAGES.map((s, i) => (
            <div key={s} className="flex items-center flex-1 last:flex-none">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${i <= stageIdx ? STAGE_CFG[s].dot : 'bg-slate-700'}`} />
              {i < STAGES.length - 1 && (
                <div className={`flex-1 h-px mx-1 transition-colors ${i < stageIdx ? STAGE_CFG[STAGES[i]].dot : 'bg-slate-700'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-0.5">
          {STAGES.map((s, i) => (
            <span key={s} className={`text-[9px] font-medium ${i <= stageIdx ? STAGE_CFG[s].color : 'text-slate-700'}`}>
              {STAGE_CFG[s].label}
            </span>
          ))}
        </div>
      </div>

      {/* Badges row */}
      <div className="px-3 pb-1 flex items-center gap-1.5 flex-wrap">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.color} bg-white/5`}>
          {cfg.label}
        </span>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          watch.stock_status === 'STOCK'
            ? 'text-green-400 bg-green-500/10'
            : 'text-amber-400 bg-amber-500/10'
        }`}>
          {watch.stock_status === 'STOCK' ? '✓ In Stock' : '⏳ Incoming'}
        </span>
        {watch.origin && (
          <span className="text-[10px] text-slate-500 px-2 py-0.5 rounded-full bg-white/5">
            {watch.origin}
          </span>
        )}
      </div>

      {/* Image */}
      <div className="relative w-full aspect-[4/3] bg-[#0d0d15] overflow-hidden">
        {watch.image_url ? (
          <Image src={watch.image_url} alt={watch.name} fill
            className="object-contain p-3 group-hover:scale-105 transition-transform duration-300" unoptimized />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-14 h-14 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {/* Brand + Model */}
        <div>
          {watch.brand && (
            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest">{watch.brand}</p>
          )}
          <h3 className="text-white font-bold text-base leading-tight">
            {watch.model || watch.name}
          </h3>
          {watch.ref_no && (
            <p className="text-slate-500 text-xs">Ref. {watch.ref_no}{watch.watch_date ? ` · ${watch.watch_date}` : ''}</p>
          )}
        </div>

        {/* Spec tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, i) => (
              <span key={i} className="text-[10px] bg-white/5 text-slate-400 px-2 py-0.5 rounded-full border border-white/5">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Bought from */}
        {watch.bought_from && (
          <p className="text-slate-600 text-xs">From: {watch.bought_from}</p>
        )}

        {/* Prices */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="bg-[#0d0d15] rounded-lg p-2">
            <div className="text-slate-500 text-[10px] mb-0.5">Website</div>
            <div className="text-blue-400 font-bold text-sm">{formatCurrency(watch.website_price)}</div>
          </div>
          <div className="bg-[#0d0d15] rounded-lg p-2">
            <div className="text-slate-500 text-[10px] mb-0.5">B2B</div>
            <div className="text-green-400 font-bold text-sm">{formatCurrency(watch.b2b_price)}</div>
          </div>
        </div>

        {/* Action button */}
        <button onClick={handleAction}
          className={`w-full py-2 rounded-xl font-semibold text-xs transition-all border ${cfg.btnCls}`}>
          {cfg.nextLabel}
        </button>
      </div>
    </div>
  )
}
