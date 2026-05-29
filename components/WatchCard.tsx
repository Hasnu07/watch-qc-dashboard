'use client'

import { useState } from 'react'
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
  serial_no?: string | null
  stock_no: string | null
  image_url: string | null
  website_price: string | number
  b2b_price: string | number
  currency?: string
  purchase_price?: string | number | null
  watch_type?: 'BUY' | 'SELL'
  sold_to?: string | null
  bought_from?: string | null
  payment_status: PaymentStatus
  location_status: LocationStatus
  stage?: WatchStage
  task_summary?: TaskSummary
  margin?: number | null
  is_stale?: boolean
  stale_reason?: string | null
  fob_url?: string | null
  linked_buy_image_url?: string | null
  linked_buy_watch_id?: number | null
  case_material?: string | null
  dial_colour?: string | null
  bracelet?: string | null
  watch_date?: string | null
}

interface WatchCardProps<W extends Watch = Watch> {
  watch: W
  compact?: boolean
  highlighted?: boolean
  searchHighlight?: string
  onCardClick: (watch: W) => void
  onRemoveRequest?: (watch: W) => void
  onOpenTasks?: (watch: W) => void
  onImageFetched?: () => void
}

function highlightText(text: string, q: string) {
  if (!q || !text.toLowerCase().includes(q.toLowerCase())) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent/20 text-ink rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

function taskProgress(summary: TaskSummary) {
  let total = 0
  let done = 0
  for (const dept of DEPT_ORDER) {
    total += summary[dept].total
    done += summary[dept].completed
  }
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 }
}

export default function WatchCard<W extends Watch>({
  watch, compact = true, highlighted = false, searchHighlight = '',
  onCardClick, onOpenTasks, onImageFetched,
}: WatchCardProps<W>) {
  const isSell = watch.watch_type === 'SELL'
  const rowClass = isSell ? 'list-row-sell' : 'list-row-buy'
  const tasksBtnClass = isSell ? 'btn-tasks-sell' : 'btn-tasks-buy'
  const [fetchingImage, setFetchingImage] = useState(false)

  const summary: TaskSummary = watch.task_summary ?? {
    LOGISTICS: { total: 0, completed: 0 },
    ACCOUNTING: { total: 0, completed: 0 },
    SALES: { total: 0, completed: 0 },
  }
  const { total: taskTotal, done: taskDone, pct: taskPct } = taskProgress(summary)
  const allDone = taskTotal > 0 && taskDone === taskTotal

  const payLabel = watch.payment_status === 'PAID' ? 'Paid' : watch.payment_status === 'PARTIAL' ? 'Partial' : 'Unpaid'
  const subtitle = [
    watch.brand,
    payLabel,
    taskTotal ? `${taskDone}/${taskTotal} tasks` : null,
    watch.is_stale ? 'Needs attention' : null,
  ].filter(Boolean).join(' · ')

  async function handleFetchImage(e: React.MouseEvent) {
    e.stopPropagation()
    if (fetchingImage) return
    setFetchingImage(true)
    try {
      await fetch(`/api/watches/${watch.id}/fetch-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: !!watch.image_url }),
      })
      onImageFetched?.()
    } finally {
      setFetchingImage(false)
    }
  }

  /* ── List row (default — TradingView-style) ── */
  if (compact) {
    return (
      <div
        onClick={() => onCardClick(watch)}
        className={`list-row ${rowClass} ${highlighted ? 'list-row-active' : ''}`}
      >
        <div className="list-row-image relative w-7 h-7 rounded bg-white overflow-hidden border border-default/40 opacity-75">
          {watch.image_url ? (
            <Image src={watch.image_url} alt="" fill className="object-contain p-px" unoptimized />
          ) : (
            <button type="button" onClick={handleFetchImage} disabled={fetchingImage}
              className="absolute inset-0 flex items-center justify-center text-muted text-[9px] hover:text-accent"
              title="Fetch image">
              {fetchingImage ? '…' : '⌚'}
            </button>
          )}
        </div>

        <div className="list-row-text">
          <div className="flex items-baseline gap-1.5 min-w-0">
            {watch.stock_no && (
              <span className="font-mono-data text-base sm:text-lg font-bold text-ink shrink-0">
                {searchHighlight ? highlightText(`#${watch.stock_no}`, searchHighlight) : `#${watch.stock_no}`}
              </span>
            )}
            <span className="text-base sm:text-lg font-bold text-ink leading-snug truncate sm:whitespace-normal sm:line-clamp-2">
              {watch.model || watch.name}
            </span>
          </div>
          <div className="flex items-baseline gap-2 min-w-0 mt-0.5">
            <p className="text-sm text-subtitle truncate min-w-0 flex-1">{subtitle}</p>
            <span className="font-mono-data text-xs sm:text-sm text-subtitle shrink-0">
              {formatCurrency(watch.website_price)}
              {isSell && watch.margin != null && (
                <span className={`ml-1.5 ${watch.margin >= 0 ? 'text-positive' : 'text-negative'}`}>
                  {watch.margin >= 0 ? '+' : ''}{formatCurrency(watch.margin)}
                </span>
              )}
            </span>
          </div>
          {taskTotal > 0 && (
            <div className="hidden md:flex items-center gap-1.5 mt-1">
              <div className="h-1 flex-1 max-w-[5rem] rounded-full bg-panel overflow-hidden">
                <div className={`h-full rounded-full ${allDone ? 'bg-positive' : 'bg-accent'}`} style={{ width: `${taskPct}%` }} />
              </div>
              <span className="text-[10px] text-muted shrink-0">{allDone ? 'Done' : `${taskPct}%`}</span>
            </div>
          )}
        </div>

        {onOpenTasks && (
          <button type="button" onClick={e => { e.stopPropagation(); onOpenTasks(watch) }}
            className={tasksBtnClass}>
            Tasks
          </button>
        )}
      </div>
    )
  }

  /* ── Card view — large vertical tiles, 3 per row ── */
  const tileClass = isSell ? 'watch-card-tile-sell' : 'watch-card-tile-buy'

  return (
    <div onClick={() => onCardClick(watch)}
      className={`watch-card-tile ${tileClass} cursor-pointer flex flex-col ${highlighted ? 'ring-2 ring-accent' : ''}`}>

      <div className="p-4 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            {watch.stock_no && (
              <span className="font-mono-data text-base font-bold text-ink">#{watch.stock_no}</span>
            )}
            <span className="text-sm text-subtitle">{watch.brand}{isSell ? ' · Sell' : ' · Buy'}</span>
          </div>
          <h3 className="text-base font-bold text-ink leading-snug line-clamp-2 mt-1">{watch.model || watch.name}</h3>
        </div>
        {onOpenTasks && (
          <button type="button" onClick={e => { e.stopPropagation(); onOpenTasks(watch) }}
            className={`${tasksBtnClass} shrink-0`}>Tasks</button>
        )}
      </div>

      <div className="relative w-full flex-1 min-h-[140px] bg-white border-y border-default">
        {watch.image_url ? (
          <Image src={watch.image_url} alt={watch.name} fill className="object-contain p-4" unoptimized />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted">
            <span className="text-3xl opacity-40 mb-2">⌚</span>
            <button type="button" onClick={handleFetchImage} disabled={fetchingImage}
              className="text-sm font-medium text-accent hover:underline">
              {fetchingImage ? 'Finding…' : 'Fetch image'}
            </button>
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2">
        <p className="text-sm text-subtitle line-clamp-2">{subtitle}</p>
        <div className="flex items-baseline gap-2">
          <span className="font-mono-data text-xl font-bold text-ink">{formatCurrency(watch.website_price)}</span>
          {isSell && watch.margin != null && (
            <span className={`text-sm font-semibold ${watch.margin >= 0 ? 'text-positive' : 'text-negative'}`}>
              {watch.margin >= 0 ? '+' : ''}{formatCurrency(watch.margin)}
            </span>
          )}
        </div>
        {taskTotal > 0 && (
          <div>
            <div className="flex justify-between text-xs text-muted mb-1.5">
              <span>Tasks</span>
              <span>{allDone ? 'Complete' : `${taskDone} of ${taskTotal}`}</span>
            </div>
            <div className="h-2 rounded-full bg-panel overflow-hidden">
              <div className={`h-full rounded-full ${allDone ? 'bg-positive' : 'bg-accent'}`} style={{ width: `${taskPct}%` }} />
            </div>
          </div>
        )}
        {isSell && watch.fob_url && (
          <a href={watch.fob_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            className="text-sm text-accent hover:underline">
            Open FOB →
          </a>
        )}
      </div>
    </div>
  )
}
