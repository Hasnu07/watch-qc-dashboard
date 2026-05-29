'use client'

import { useState } from 'react'
import Image from 'next/image'
import { formatCurrency } from '@/lib/utils'
import { DEPT_ORDER, type Department } from '@/lib/ui-constants'
import { getImageQuality } from '@/lib/image-quality-badge'

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
  const [fetchingImage, setFetchingImage] = useState(false)

  const summary: TaskSummary = watch.task_summary ?? {
    LOGISTICS: { total: 0, completed: 0 },
    ACCOUNTING: { total: 0, completed: 0 },
    SALES: { total: 0, completed: 0 },
  }
  const { total: taskTotal, done: taskDone, pct: taskPct } = taskProgress(summary)
  const allDone = taskTotal > 0 && taskDone === taskTotal
  const imageQuality = getImageQuality(watch)

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
        className={`list-row ${highlighted ? 'list-row-active' : ''}`}
        style={{ borderLeftWidth: highlighted ? undefined : 3, borderLeftColor: isSell ? 'var(--color-sell)' : 'var(--color-buy)' }}
      >
        <div className="relative w-11 h-11 rounded-lg bg-white flex-shrink-0 overflow-hidden border border-default">
          {watch.image_url ? (
            <Image src={watch.image_url} alt="" fill className="object-contain p-0.5" unoptimized />
          ) : (
            <button type="button" onClick={handleFetchImage} disabled={fetchingImage}
              className="absolute inset-0 flex items-center justify-center text-muted text-xs hover:text-accent"
              title="Fetch image">
              {fetchingImage ? '…' : '⌚'}
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            {watch.stock_no && (
              <span className="font-mono-data text-sm font-semibold text-ink shrink-0">
                {searchHighlight ? highlightText(`#${watch.stock_no}`, searchHighlight) : `#${watch.stock_no}`}
              </span>
            )}
            <span className="text-sm font-medium text-ink truncate">{watch.model || watch.name}</span>
          </div>
          <p className="text-xs text-muted truncate mt-0.5">{subtitle}</p>
        </div>

        <div className="text-right shrink-0 min-w-[5.5rem]">
          <div className="font-mono-data text-sm font-semibold text-ink">
            {formatCurrency(watch.website_price)}
          </div>
          {isSell && watch.margin != null && (
            <div className={`text-xs font-medium ${watch.margin >= 0 ? 'text-positive' : 'text-negative'}`}>
              {watch.margin >= 0 ? '+' : ''}{formatCurrency(watch.margin)}
            </div>
          )}
        </div>

        <div className="w-14 shrink-0 hidden sm:block">
          {taskTotal > 0 && (
            <div className="h-1.5 rounded-full bg-panel overflow-hidden">
              <div className={`h-full rounded-full ${allDone ? 'bg-positive' : 'bg-accent'}`} style={{ width: `${taskPct}%` }} />
            </div>
          )}
          <p className="text-[10px] text-muted text-center mt-1">{allDone ? 'Done' : taskTotal ? `${taskPct}%` : '—'}</p>
        </div>

        {onOpenTasks && (
          <button type="button" onClick={e => { e.stopPropagation(); onOpenTasks(watch) }}
            className="btn-ghost text-xs px-2 py-1 shrink-0 hidden md:inline-flex">
            Tasks
          </button>
        )}
      </div>
    )
  }

  /* ── Card view (optional) ── */
  return (
    <div onClick={() => onCardClick(watch)}
      className={`card cursor-pointer flex flex-col ${highlighted ? 'ring-2 ring-accent' : ''}`}
      style={{ borderLeftWidth: 3, borderLeftColor: isSell ? 'var(--color-sell)' : 'var(--color-buy)' }}>

      <div className="relative w-full aspect-[4/3] bg-white border-b border-default">
        {watch.image_url ? (
          <Image src={watch.image_url} alt={watch.name} fill className="object-contain p-4" unoptimized />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted">
            <span className="text-3xl opacity-40 mb-2">⌚</span>
            <button type="button" onClick={handleFetchImage} disabled={fetchingImage}
              className="text-xs font-medium text-accent hover:underline">
              {fetchingImage ? 'Finding…' : 'Fetch image'}
            </button>
          </div>
        )}
        {watch.stock_no && (
          <span className="absolute top-3 left-3 text-xs font-mono-data font-semibold px-2 py-1 rounded bg-ink/80 text-white">
            #{watch.stock_no}
          </span>
        )}
        <span className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded bg-panel/90 text-muted border border-default">
          {imageQuality}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted">{watch.brand}{isSell ? ' · Sell' : ' · Buy'}</p>
            <h3 className="text-base font-semibold text-ink leading-snug">{watch.model || watch.name}</h3>
          </div>
          {onOpenTasks && (
            <button type="button" onClick={e => { e.stopPropagation(); onOpenTasks(watch) }}
              className="btn-ghost text-xs px-2 py-1 shrink-0">Tasks</button>
          )}
        </div>

        <p className="text-xs text-muted">{subtitle}</p>

        <div className="flex items-baseline justify-between mt-1">
          <span className="font-mono-data text-xl font-semibold text-ink">{formatCurrency(watch.website_price)}</span>
          {isSell && watch.margin != null && (
            <span className={`text-sm font-medium ${watch.margin >= 0 ? 'text-positive' : 'text-negative'}`}>
              {formatCurrency(watch.margin)}
            </span>
          )}
        </div>

        {taskTotal > 0 && (
          <div>
            <div className="flex justify-between text-xs text-muted mb-1">
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
            className="text-xs text-accent hover:underline mt-1">
            Open FOB →
          </a>
        )}
      </div>
    </div>
  )
}
