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

function paymentLabel(status: PaymentStatus) {
  if (status === 'PAID') return 'Paid'
  if (status === 'PARTIAL') return 'Partial'
  return 'Unpaid'
}

function IconListTodo({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 6h11M9 12h11M9 18h11" strokeLinecap="round" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" strokeLinecap="round" strokeWidth="3" />
    </svg>
  )
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg className={className} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  )
}

function IconAlert({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
    </svg>
  )
}

function IconTrendUp({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 16l6-6 4 4 6-8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 6h6v6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function WatchCard<W extends Watch>({
  watch, compact = false, highlighted = false, searchHighlight = '',
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
  const payLabel = paymentLabel(watch.payment_status)
  const displayPrice = Number(watch.website_price) || Number(watch.purchase_price) || 0
  const modelTitle = watch.model || watch.name

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

  if (compact) {
    const subtitle = [
      watch.brand,
      payLabel,
      taskTotal ? `${taskDone}/${taskTotal} tasks` : null,
      watch.is_stale ? 'Needs attention' : null,
    ].filter(Boolean).join(' · ')

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
              {modelTitle}
            </span>
          </div>
          <div className="flex items-baseline gap-2 min-w-0 mt-0.5">
            <p className="text-sm text-subtitle truncate min-w-0 flex-1">{subtitle}</p>
            <span className="font-mono-data text-xs sm:text-sm text-subtitle shrink-0">
              {formatCurrency(displayPrice)}
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

  const themeClass = isSell ? 'watch-card-premium--sell' : 'watch-card-premium--buy'

  return (
    <article
      onClick={() => onCardClick(watch)}
      className={`watch-card-premium ${themeClass} ${highlighted ? 'watch-card-premium--active' : ''}`}
    >
      <div className="watch-card-premium__accent" aria-hidden />

      <div className="watch-card-premium__header">
        <div className="watch-card-premium__heading">
          <div className="watch-card-premium__meta">
            <span className="watch-card-premium__brand">
              {searchHighlight && watch.brand
                ? highlightText(watch.brand, searchHighlight)
                : (watch.brand || 'Watch')}
            </span>
            <span className="watch-card-premium__meta-dot" aria-hidden />
            <span className="watch-card-premium__phase">{isSell ? 'Sell' : 'Buy'}</span>
          </div>
          <h3 className="watch-card-premium__title">
            {searchHighlight ? highlightText(modelTitle, searchHighlight) : modelTitle}
          </h3>
        </div>

        {onOpenTasks && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onOpenTasks(watch) }}
            className="watch-card-premium__tasks-btn"
          >
            <IconListTodo />
            <span>Tasks</span>
          </button>
        )}
      </div>

      <div className="watch-card-premium__image-stage">
        {watch.stock_no && (
          <div className="watch-card-premium__stock-badge">
            <span className="watch-card-premium__stock-label">Stock</span>
            <span className="watch-card-premium__stock-no">
              #{searchHighlight ? highlightText(watch.stock_no, searchHighlight) : watch.stock_no}
            </span>
          </div>
        )}

        {watch.image_url ? (
          <div className="watch-card-premium__image-wrap">
            <Image
              src={watch.image_url}
              alt={modelTitle}
              fill
              className="watch-card-premium__image"
              unoptimized
            />
          </div>
        ) : (
          <div className="watch-card-premium__image-empty">
            <span className="text-3xl opacity-30 mb-2">⌚</span>
            <button type="button" onClick={handleFetchImage} disabled={fetchingImage}
              className="watch-card-premium__fetch-btn">
              {fetchingImage ? 'Finding…' : 'Fetch image'}
            </button>
          </div>
        )}
      </div>

      <div className="watch-card-premium__footer">
        <div className="watch-card-premium__valuation">
          <span className="watch-card-premium__valuation-label">Valuation</span>
          <div className="watch-card-premium__price-row">
            <span className="watch-card-premium__price">{formatCurrency(displayPrice)}</span>
            {isSell && watch.margin != null && (
              <span className="watch-card-premium__profit">
                <IconTrendUp />
                {watch.margin >= 0 ? '+' : ''}{formatCurrency(watch.margin)}
              </span>
            )}
          </div>
        </div>

        <div className="watch-card-premium__status-row">
          <div className="watch-card-premium__status-left">
            {watch.payment_status === 'PAID' ? (
              <span className="watch-card-premium__status-icon watch-card-premium__status-icon--paid">✓</span>
            ) : (
              <IconAlert className="watch-card-premium__status-icon watch-card-premium__status-icon--unpaid" />
            )}
            <span>{payLabel}</span>
            {taskTotal > 0 && (
              <>
                <span className="watch-card-premium__meta-dot" aria-hidden />
                <span className="watch-card-premium__task-count">
                  <IconClock />
                  {taskDone}/{taskTotal} tasks
                </span>
              </>
            )}
          </div>
          <span className="watch-card-premium__pct font-mono-data">{taskPct}%</span>
        </div>

        <div className="watch-card-premium__progress-track">
          <div
            className="watch-card-premium__progress-fill"
            style={{ width: `${taskPct === 0 && taskTotal > 0 ? 2 : taskPct}%` }}
          />
        </div>

        {isSell && watch.fob_url && (
          <a href={watch.fob_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            className="watch-card-premium__fob-link">
            Open FOB →
          </a>
        )}
      </div>
    </article>
  )
}
