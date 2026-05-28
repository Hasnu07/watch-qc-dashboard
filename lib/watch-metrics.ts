type TaskSummary = Record<'LOGISTICS' | 'ACCOUNTING' | 'SALES', { total: number; completed: number }>

export interface WatchWithMetrics {
  id: number
  watch_type?: string | null
  created_at: Date | string
  purchase_price?: unknown
  website_price?: unknown
  logistics_cost?: number | null
  linked_buy_watch_id?: number | null
  task_summary?: TaskSummary
  buy_purchase_price?: number | null
  margin?: number | null
  days_in_pipeline?: number
  is_stale?: boolean
  stale_reason?: string | null
}

export function enrichWatchMetrics<T extends WatchWithMetrics>(
  watch: T,
  buyPriceById: Map<number, number>,
): T & { buy_purchase_price?: number | null; margin?: number | null; days_in_pipeline: number; is_stale: boolean; stale_reason?: string | null } {
  const created = new Date(watch.created_at)
  const daysInPipeline = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24))

  let buyPurchase: number | null = null
  if (watch.watch_type === 'SELL') {
    if (watch.linked_buy_watch_id) {
      buyPurchase = buyPriceById.get(watch.linked_buy_watch_id) ?? null
    }
    if (buyPurchase == null && watch.purchase_price != null) {
      buyPurchase = Number(watch.purchase_price)
    }
  } else if (watch.purchase_price != null) {
    buyPurchase = Number(watch.purchase_price)
  }

  const sellPrice = watch.website_price != null ? Number(watch.website_price) : null
  let margin: number | null = null
  if (watch.watch_type === 'SELL' && buyPurchase != null && sellPrice != null) {
    margin = sellPrice - buyPurchase - (watch.logistics_cost || 0)
  }

  const summary = watch.task_summary
  let isStale = false
  let staleReason: string | null = null
  if (summary && daysInPipeline >= 7) {
    for (const dept of ['ACCOUNTING', 'SALES', 'LOGISTICS'] as const) {
      const s = summary[dept]
      if (s.total > 0 && s.completed < s.total) {
        isStale = true
        staleReason = `${dept.charAt(0) + dept.slice(1).toLowerCase()} tasks pending ${daysInPipeline}d`
        break
      }
    }
  }
  if (!isStale && daysInPipeline >= 14) {
    isStale = true
    staleReason = `In pipeline ${daysInPipeline} days`
  }

  return {
    ...watch,
    buy_purchase_price: buyPurchase,
    margin,
    days_in_pipeline: daysInPipeline,
    is_stale: isStale,
    stale_reason: staleReason,
  }
}

export function computePipelineStats(watches: WatchWithMetrics[]) {
  let totalValue = 0
  let staleCount = 0
  let sellMarginSum = 0
  let sellMarginCount = 0

  for (const w of watches) {
    const price = Number(w.website_price || w.purchase_price || 0)
    if (price) totalValue += price
    if (w.is_stale) staleCount++
    if (w.margin != null) {
      sellMarginSum += w.margin
      sellMarginCount++
    }
  }

  return {
    total_watches: watches.length,
    total_pipeline_value: Math.round(totalValue),
    stale_count: staleCount,
    avg_sell_margin: sellMarginCount ? Math.round(sellMarginSum / sellMarginCount) : null,
  }
}
