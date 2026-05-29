'use client'

import { useState } from 'react'
import Image from 'next/image'
import { formatCurrency } from '@/lib/utils'
import { DEPT_ORDER, type Department } from '@/lib/ui-constants'
import { getImageQuality, type ImageQuality } from '@/lib/image-quality-badge'

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
  linked_buy_image_url?: string | null
}

interface WatchCardProps {
  watch: Watch
  compact?: boolean
  highlighted?: boolean
  searchHighlight?: string
  onCardClick: (watch: Watch) => void
  onRemoveRequest?: (watch: Watch) => void
  onOpenTasks?: (watch: Watch) => void
  onImageFetched?: () => void
}

function highlightText(text: string, q: string) {
  if (!q || !text.toLowerCase().includes(q.toLowerCase())) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-sand rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

function badge(text: string, variant: 'neutral' | 'accent' | 'warn' | 'ok' | 'image' = 'neutral') {
  const cls = {
    neutral: 'bg-card border-default text-muted',
    accent: 'bg-accent/10 border-accent/30 text-accent',
    warn: 'bg-sand/40 border-default text-ink',
    ok: 'bg-card border-accent/40 text-accent',
    image: 'bg-ink/80 border-ink/20 text-card',
  }[variant]
  return `text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${cls}`
}

function imageBadgeVariant(quality: ImageQuality): 'image' | 'ok' | 'warn' | 'neutral' {
  if (quality === 'Official') return 'ok'
  if (quality === 'Missing') return 'warn'
  return 'image'
}

export default function WatchCard({
  watch, compact = false, highlighted = false, searchHighlight = '',
  onCardClick, onRemoveRequest, onOpenTasks, onImageFetched,
}: WatchCardProps) {
  const isSell = watch.watch_type === 'SELL'
  const [fetchingImage, setFetchingImage] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fobSaving, setFobSaving] = useState(false)
  const imageQuality = getImageQuality(watch)

  async function markFobUpdated(e: React.MouseEvent) {
    e.stopPropagation()
    if (fobSaving) return
    setFobSaving(true)
    try {
      const res = await fetch(`/api/watch-tasks?phase=SELL&watch_id=${watch.id}`)
      if (!res.ok) return
      const tasks = await res.json()
      const fobTask = tasks.find((t: { task_type: string; is_completed: boolean }) =>
        /fob/i.test(t.task_type) && !t.is_completed)
      if (fobTask) {
        await fetch(`/api/watch-tasks/${fobTask.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_completed: true }),
        })
        onImageFetched?.()
      }
    } finally {
      setFobSaving(false)
    }
  }

  async function handleFetchImage(e: React.MouseEvent) {
    e.stopPropagation()
    if (fetchingImage) return
    setFetchingImage(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/watches/${watch.id}/fetch-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: !!watch.image_url }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFetchError(data.error || 'Could not find an image')
        return
      }
      onImageFetched?.()
    } catch {
      setFetchError('Could not find an image')
    } finally {
      setFetchingImage(false)
    }
  }

  const summary: TaskSummary = watch.task_summary ?? {
    LOGISTICS: { total: 0, completed: 0 },
    ACCOUNTING: { total: 0, completed: 0 },
    SALES: { total: 0, completed: 0 },
  }
  const deptDone = (s: Department) => summary[s].total > 0 && summary[s].completed === summary[s].total
  const allDone = DEPT_ORDER.every(deptDone)
  const doneCount = DEPT_ORDER.filter(deptDone).length

  const payLabel = watch.payment_status === 'PAID' ? 'Paid' : watch.payment_status === 'PARTIAL' ? 'Partial' : 'Unpaid'
  const payVariant = watch.payment_status === 'PAID' ? 'ok' : watch.payment_status === 'PARTIAL' ? 'warn' : 'neutral'

  const cardRing = highlighted
    ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface'
    : isSell ? 'hover:border-sell/80' : 'hover:border-buy/80'
  const cardBorder = isSell ? 'border-2 border-sell' : 'border-2 border-buy'

  if (compact) {
    return (
      <div onClick={() => onCardClick(watch)}
        className={`card cursor-pointer flex gap-3 p-3 transition-colors ${cardBorder} ${cardRing}`}>
        <div className="relative w-16 h-16 rounded-2xl bg-white flex-shrink-0 overflow-hidden border border-default">
          {watch.image_url ? (
            <Image src={watch.image_url} alt={watch.name} fill className="object-contain p-1" unoptimized />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-xl text-muted">⌚</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              {watch.stock_no && (
                <span className="section-label text-[10px]">
                  {searchHighlight ? highlightText(`#${watch.stock_no}`, searchHighlight) : `#${watch.stock_no}`}
                </span>
              )}
              <h3 className="font-display text-sm font-semibold text-ink truncate">{watch.model || watch.name}</h3>
            </div>
            {onOpenTasks && (
              <button type="button" onClick={e => { e.stopPropagation(); onOpenTasks(watch) }}
                className="btn-ghost text-[10px] px-2 py-1 flex-shrink-0">Tasks</button>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            <span className={badge(payLabel, payVariant)}>{payLabel}</span>
            <span className={badge(isSell ? 'Sell' : 'Buy', isSell ? 'accent' : 'neutral')} />
            {watch.is_stale && <span className={badge('Stale', 'warn')} title={watch.stale_reason || undefined} />}
            {isSell && watch.margin != null && (
              <span className={badge(formatCurrency(watch.margin), watch.margin >= 0 ? 'ok' : 'neutral')} />
            )}
            <span className={badge(allDone ? 'Done' : `${doneCount}/3`, allDone ? 'ok' : 'neutral')} />
          </div>
        </div>
      </div>
    )
  }

  const tags = [watch.case_material, watch.dial_colour, watch.bracelet].filter(Boolean)
  const locLabel = watch.location_status === 'IN_TRANSIT' ? 'In transit' : watch.location_status === 'IN_STOCK' ? 'In stock' : 'Incoming'

  return (
    <div onClick={() => onCardClick(watch)}
      className={`card group flex flex-col cursor-pointer transition-colors ${cardBorder} ${cardRing}`}>
      <div className="px-4 py-3 flex items-center justify-between border-b border-default">
        <span className={`section-label ${isSell ? 'text-accent' : ''}`}>{isSell ? 'Sell' : 'Buy'}</span>
        {onRemoveRequest && (
          <button type="button" title="Remove"
            onClick={e => { e.stopPropagation(); onRemoveRequest(watch) }}
            className="text-[10px] font-medium text-muted hover:text-ink transition-colors">
            Remove
          </button>
        )}
      </div>

      <div className="px-4 py-3 border-b border-default">
        <div className="flex items-center gap-1">
          {DEPT_ORDER.map((s, i) => {
            const done = deptDone(s)
            return (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className={`w-4 h-4 rounded-full flex-shrink-0 border flex items-center justify-center ${done ? 'bg-accent border-accent text-white' : 'bg-card border-default'}`}>
                  {done && <span className="text-[8px] font-bold">✓</span>}
                </div>
                {i < DEPT_ORDER.length - 1 && (
                  <div className={`flex-1 h-px mx-1 ${deptDone(DEPT_ORDER[i]) ? 'bg-accent/60' : 'bg-ink/10'}`} />
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-2">
          {DEPT_ORDER.map(s => (
            <span key={s} className={`text-[8px] font-semibold uppercase tracking-widest ${deptDone(s) ? 'text-accent' : 'text-muted'}`}>
              {s.slice(0, 4)}
            </span>
          ))}
        </div>
      </div>

      <div className="px-4 py-2 flex flex-wrap items-center gap-1.5 border-b border-default">
        <span className={badge(payLabel, payVariant)}>{payLabel}</span>
        {watch.is_stale && <span className={badge('Stale', 'warn')} title={watch.stale_reason || undefined} />}
        {isSell && watch.linked_buy_watch_id && <span className={badge(`Buy #${watch.linked_buy_watch_id}`, 'neutral')} />}
        <span className={`${badge(isSell ? 'Sale' : locLabel, isSell ? 'accent' : 'neutral')} ml-auto`}>
          {isSell ? 'Sale' : locLabel}
        </span>
      </div>

      <div className="relative w-full aspect-[4/3] bg-white overflow-hidden border-b border-default group/image">
        {watch.image_url ? (
          <>
            <Image src={watch.image_url} alt={watch.name} fill className="object-contain p-4 group-hover:scale-[1.02] transition-transform duration-500" unoptimized />
            <button type="button" onClick={handleFetchImage} disabled={fetchingImage}
              title="Refetch official image"
              className="absolute bottom-3 right-3 text-[10px] font-semibold px-2.5 py-1 rounded-full border border-default bg-card/95 text-muted opacity-0 group-hover/image:opacity-100 hover:text-accent transition-opacity disabled:opacity-60">
              {fetchingImage ? '…' : '↻ Refetch'}
            </button>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-muted px-4">
            <span className="text-4xl opacity-40">⌚</span>
            <span className="text-xs mt-1">No image</span>
            <button type="button" onClick={handleFetchImage} disabled={fetchingImage}
              className="mt-3 text-xs font-semibold px-4 py-2 rounded-full border border-accent/40 text-accent bg-card hover:bg-accent/5 transition-colors disabled:opacity-60">
              {fetchingImage ? 'Finding image…' : 'Fetch image'}
            </button>
            {fetchError && <span className="text-[10px] text-accent/80 mt-2 text-center">{fetchError}</span>}
          </div>
        )}
        {watch.stock_no && (
          <div className="absolute top-3 left-3">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-ink text-card font-mono-data">
              {searchHighlight ? highlightText(`#${watch.stock_no}`, searchHighlight) : `#${watch.stock_no}`}
            </span>
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span className={badge(imageQuality, imageBadgeVariant(imageQuality))}>{imageQuality}</span>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {watch.brand && <p className="section-label mb-1">{watch.brand}</p>}
            <h3 className="font-display text-lg font-semibold text-ink leading-tight">{watch.model || watch.name}</h3>
          </div>
          {onOpenTasks && (
            <button type="button" onClick={e => { e.stopPropagation(); onOpenTasks(watch) }}
              className="btn-ghost text-[10px] px-3 py-1.5 flex-shrink-0">Tasks</button>
          )}
        </div>

        {(watch.ref_no || watch.watch_date) && (
          <p className="text-muted text-xs font-mono-data">
            {watch.ref_no && <>Ref. {watch.ref_no}</>}
            {watch.ref_no && watch.watch_date && <span> · </span>}
            {watch.watch_date}
          </p>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag, i) => (
              <span key={i} className="text-[11px] bg-panel text-muted px-2.5 py-0.5 rounded-full font-medium border border-default">{tag}</span>
            ))}
          </div>
        )}

        {isSell && watch.sold_to && <p className="text-muted text-xs">Sold to {watch.sold_to}</p>}
        {isSell && watch.fob_url && (
          <div className="flex flex-wrap gap-2">
            <a href={watch.fob_url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-accent/40 text-accent bg-card hover:bg-accent/5">
              Open FOB
            </a>
            <button type="button" onClick={markFobUpdated} disabled={fobSaving}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border border-default text-muted bg-panel hover:text-accent disabled:opacity-60">
              {fobSaving ? '…' : 'Mark FOB updated'}
            </button>
          </div>
        )}
        {!isSell && watch.bought_from && <p className="text-muted text-xs">From {watch.bought_from}</p>}
        {isSell && watch.margin != null && (
          <p className={`text-sm font-semibold ${watch.margin >= 0 ? 'text-accent' : 'text-muted'}`}>
            Margin {formatCurrency(watch.margin)}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 mt-auto">
          <div className="rounded-2xl p-3 border border-default bg-panel">
            <div className="section-label text-[9px] mb-1">{isSell ? 'Sale' : 'Website'}</div>
            <div className="text-ink font-display text-lg font-semibold font-mono-data">{formatCurrency(watch.website_price)}</div>
          </div>
          <div className="rounded-2xl p-3 border border-default bg-card">
            <div className="section-label text-[9px] mb-1">{isSell ? 'Stock' : 'B2B'}</div>
            <div className="text-ink font-display text-lg font-semibold font-mono-data">
              {isSell && watch.stock_no ? `#${watch.stock_no}` : formatCurrency(watch.b2b_price)}
            </div>
          </div>
        </div>

        <div className={`w-full py-2.5 rounded-full text-sm text-center border font-medium ${allDone ? 'border-accent/40 text-accent bg-accent/5' : 'border-default text-muted bg-panel'}`}>
          {allDone ? 'All tasks complete' : `${doneCount} of ${DEPT_ORDER.length} departments done`}
        </div>
      </div>
    </div>
  )
}
